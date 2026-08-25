import {
  GtcTouchButton,
  GtcView,
  TabbedContainer,
  TabbedContent,
  GtcList,
  GtcListItem,
  GtcViewKeys,
  GtcViewLifecyclePolicy,
  GtcValueTouchButton,
  GtcListSelectTouchButton,
  GtcInteractionEvent,
  DigitInputSlot,
  NumberInput,
  NumberPad,
  GtcToggleTouchButton,
  GtcMessageDialog,
  GtcLoadFrequencyDialog,
} from "@microsoft/msfs-wtg3000-gtc";
import {
  DefaultUserSettingManager,
  DisplayComponent,
  FSComponent,
  Subject,
  ArraySubject,
  ObjectSubject,
  CasRegistrationManager,
  AnnunciationType,
  AuralAlertRegistrationManager,
  SetSubject,
  MathUtils,
  UnitType,
  ComSpacing,
  RadioFrequencyFormatter,
  FacilitySearchType,
} from "@microsoft/msfs-sdk";
import {
  ComRadioSpacingSettingMode,
  ComRadioUserSettings,
  DynamicList,
  ImgTouchButton,
  NumberUnitDisplay,
} from "@microsoft/msfs-garminsdk";
import { G3000FilePaths } from "@microsoft/msfs-wtg3000-common";
import {
  convertUnixToHHMM,
  createClient,
  messageStateUpdate,
} from "./Hoppie.mjs";
import getAircraftIcao from "./AircraftModels.mjs";
import { extractContactFrequency } from "./utils.mjs";

const BASE = "coui://html_ui/garmin-3000-acars/assets";

class StatusLine extends DisplayComponent {
  constructor() {
    super(...arguments);
    this.classes = Subject.create(
      this.props.dotted.get()
        ? "acars-status-line line-dotted"
        : "acars-status-line",
    );
    this.props.dotted.sub((e) => {
      this.classes.set(
        e ? "acars-status-line line-dotted" : "acars-status-line",
      );
    });
  }
  render() {
    return (
      <div
        style={{
          display: this.props.isVisible.map((e) => (e ? "block" : "none")),
          left: this.props.left,
          top: this.props.top,
        }}
        class={this.classes}
      >
        <div
          style={{ background: this.props.backgroundColor.map((e) => e) }}
          class={"acars-l-g"}
        />
        <div
          style={{ background: this.props.backgroundColor.map((e) => e) }}
          class={"acars-l-s"}
        />
        <div
          style={{ background: this.props.backgroundColor.map((e) => e) }}
          class={"acars-l-g"}
        />
        <div
          style={{ background: this.props.backgroundColor.map((e) => e) }}
          class={"acars-l-s"}
        />
        <div
          style={{ background: this.props.backgroundColor.map((e) => e) }}
          class={"acars-l-g"}
        />
        <div
          style={{ background: this.props.backgroundColor.map((e) => e) }}
          class={"acars-l-s"}
        />
      </div>
    );
  }
}
class StatusTab extends DisplayComponent {
  constructor() {
    super(...arguments);

    this.firstLineLeft =
      this.props.gtcService.orientation === "horizontal" ? "67px" : "36px";
    this.secondLineLeft =
      this.props.gtcService.orientation === "horizontal" ? "179px" : "89px";
    this.firstLineTop =
      this.props.gtcService.orientation === "horizontal" ? "9px" : "18px";
    this.secondLineTop =
      this.props.gtcService.orientation === "horizontal" ? "9px" : "18px";
    this.listRef = FSComponent.createRef();
    this.listItemHeight =
      this.props.gtcService.orientation === "horizontal" ? 110 : 65;
    this.facility = Subject.create("");
    this.flightId = Subject.create("");
    this.destinationAirport = Subject.create(
      (() => {
        const fp = this.props.fms.getPrimaryFlightPlan();
        if (fp && fp.destinationAirportIcao)
          return fp.destinationAirportIcao.ident;
        return "";
      })(),
    );
    this.departureAirport = Subject.create(
      (() => {
        const fp = this.props.fms.getPrimaryFlightPlan();
        if (fp && fp.originAirportIcao) return fp.originAirportIcao.ident;
        return "";
      })(),
    );
    this.conBtnState = Subject.create("Logon");
    this.conBtnEnabled = Subject.create(false);
    this.acarsConnected = Subject.create(false);
    this.station = Subject.create("----");
    this.nextStation = Subject.create("----");
    this.secondLineEnabled = Subject.create(false);
    this.secondLineDotted = Subject.create(false);
    this.secondLineYellow = Subject.create(false);

    this.props.gtcService.bus
      .getSubscriber()
      .on("acars_message")
      .handle((message) => {
        const client = this.props.client.get();
        if (!client) return;
        if (this.props.gtcService.gtcThisSide === "right")
          messageStateUpdate(client, message);
        this.conBtnState.set(client.active_station ? "Logoff" : "Logon");
        this.station.set(client.active_station || "----");
        this.nextStation.set(client.pending_station || "----");
        this.secondLineEnabled.set(
          client.active_station || client.pending_station,
        );
        this.secondLineDotted.set(
          client.pending_station && !client.active_station,
        );
        this.secondLineYellow.set(
          client.pending_station && !client.active_station,
        );
      });
    this.facility.sub((v) => {
      this.conBtnEnabled.set(this.props.client.get() !== null && v.length);
    });
    this.props.client.sub((v) => {
      this.conBtnEnabled.set(v !== null && this.facility.get().length);
      this.acarsConnected.set(v !== null);
    });
    this.itemList = [
      {
        label: "Facility",
        source: this.facility,
        renderValue: (v) => (v && v.length ? v : "----"),
        type: GtcViewKeys.TextDialog,
      },
      {
        label: "Flight ID",
        source: this.flightId,
        renderValue: (v) => (v && v.length ? v : "----"),
        type: GtcViewKeys.TextDialog,
      },
      {
        label: "Destination Airport",
        source: this.destinationAirport,
        renderValue: (v) => (v && v.length ? v : "----"),
        type: GtcViewKeys.WaypointDialog,
      },
      {
        label: "Filed Dep Airport",
        source: this.departureAirport,
        renderValue: (v) => (v && v.length ? v : "----"),
        type: GtcViewKeys.WaypointDialog,
      },
      {
        label: "Filed Dep Time",
        source: this.props.departureTime,
        renderValue: (r) => {
          const v = r > 60 * 24 ? r / 60 : r;
          return v
            ? `${Math.floor(v / 60)
                .toString()
                .padStart(2, "0")}:${Math.floor(v % 60)
                .toString()
                .padStart(2, "0")} UTC`
            : "__:__ UTC";
        },
        type: GtcViewKeys.DurationDialog1,
      },
    ];
    this.props.gtcService.bus
      .getSubscriber()
      .on("acars_status_param")
      .handle((e) => {
        this.itemList.find((x) => x.label === e.label).source.set(e.value);
      });
  }
  onResume() {
    // for (const sub of this.subscriptions) {
    //   sub.resume(true);
    // }
  }
  /** @inheritDoc */
  onPause() {
    // for (const sub of this.subscriptions) {
    //   sub.pause();
    // }
  }
  onAfterRender(thisNode) {
    this.thisNode = thisNode;
  }
  onGtcInteractionEvent() {
    return false;
  }
  stateBtnPressed() {
    const client = this.props.client.get();
    if (!client) return;
    if (window.acarsSide === "primary") {
      if (!client.active_station) client.sendLogonRequest(this.facility.get());
      else client.sendLogoffRequest();
    } else {
      this.props.gtcService.bus.getPublisher().pub(
        "acars_message_request",
        {
          key: !client.active_station
            ? "sendLogonRequest"
            : "sendLogoffRequest",
          arguments: [this.facility.get()],
        },
        true,
        false,
      );
    }
    this.facility.set("");
  }
  render() {
    const sidebarState = Subject.create(null);
    return (
      <div class={"acars-page-status-tab"}>
        <div class={"acars-status-page-tab-left"}>
          <div class={"title-col"}>
            <span>Logon Setup</span>
          </div>
          <GtcList
            ref={this.listRef}
            listItemSpacingPx={1}
            sidebarState={sidebarState}
            bus={this.bus}
            itemsPerPage={5}
            listItemHeightPx={this.listItemHeight}
          >
            {this.itemList.map((e) => (
              <GtcListItem hideBorder key={e.label}>
                <GtcValueTouchButton
                  class={"acars-status-page-tab-left-list-item"}
                  state={e.source}
                  label={e.label}
                  renderValue={e.renderValue}
                  onPressed={async () => {
                    const requestParams = {
                      initialValue: e.source.get(),
                      initialInputText: e.source.get(),
                    };

                    if (e.type === GtcViewKeys.WaypointDialog) {
                      requestParams.searchType = FacilitySearchType.Airport;
                      requestParams.emptyLabelText = e.label;
                    } else {
                      requestParams.label = e.label;
                      requestParams.allowSpaces = false;
                      requestParams.maxLength = 20;
                    }

                    const result = await this.props.gtcService
                      .openPopup(e.type, "normal", "hide")
                      .ref.request(requestParams);

                    if (result.wasCancelled) {
                      return;
                    }

                    this.props.gtcService.bus.getPublisher().pub(
                      "acars_status_param",
                      {
                        label: e.label,
                        value:
                          result.payload?.icaoStruct?.ident ?? result.payload,
                      },
                      true,
                      false,
                    );
                  }}
                  isInList={true}
                />
              </GtcListItem>
            ))}
          </GtcList>
        </div>
        <div class={"acars-status-page-tab-right"}>
          <span>
            Connection: {this.acarsConnected.map((e) => (e ? "ATN" : "----"))}
          </span>
          <div class={"icons-list acars-pane-padding"}>
            <StatusLine
              dotted={Subject.create(false)}
              isVisible={this.acarsConnected}
              backgroundColor={Subject.create("green")}
              left={this.firstLineLeft}
              top={this.firstLineTop}
            />
            <StatusLine
              dotted={this.secondLineDotted}
              isVisible={this.secondLineEnabled}
              backgroundColor={this.secondLineYellow.map((e) =>
                e ? "yellow" : "green",
              )}
              left={this.secondLineLeft}
              top={this.secondLineTop}
            />

            <img src="coui://html_ui/garmin-3000-acars/assets/plane.png" />
            <img src="coui://html_ui/garmin-3000-acars/assets/anntena.png" />
            <img src="coui://html_ui/garmin-3000-acars/assets/tower.png" />
          </div>
          <span class={"acars-pane-padding"}>ATN Link Available</span>
          <GtcTouchButton
            onPressed={this.stateBtnPressed.bind(this)}
            label={this.conBtnState}
            isEnabled={this.conBtnEnabled}
            class={"state-btn acars-pane-padding"}
          />
          <div class={"acars-pane-padding acars-pane-center border-btm"}>
            <span class={"normal"}>Current Facility</span>
            <span class={"big"}>{this.station}</span>
            <br />
          </div>
          <div class={"acars-pane-padding acars-pane-center"}>
            <span class={"normal"}>Next Facility</span>
            <span class={"big"}>{this.nextStation}</span>
            <br />
          </div>
        </div>
      </div>
    );
  }
}
class CpdlcTab extends DisplayComponent {
  constructor() {
    super(...arguments);
    this.listRef = FSComponent.createRef();
    this.messages = ArraySubject.create();
    this.listItemHeight =
      this.props.gtcService.orientation === "horizontal" ? 230 : 120;
    if (window.acarsSide === "primary") {
      this.props.gtcService.bus
        .getSubscriber()
        .on("acars_message_state_request")
        .handle((e) => {
          this.props.gtcService.bus
            .getPublisher()
            .pub(
              "acars_state_message_response",
              { messages: this.messages.getArray() },
              true,
              false,
            );
        });
    } else {
      const sub = this.props.gtcService.bus
        .getSubscriber()
        .on("acars_state_message_response")
        .handle((e) => {
          for (const entry of e.messages) this.messages.insert(entry);
          sub.destroy();
        });
      this.props.gtcService.bus
        .getPublisher()
        .pub("acars_message_state_request", null, true, false);
    }
    this.props.gtcService.bus
      .getSubscriber()
      .on("acars_message")
      .handle((e) => {
        e.state = Subject.create(
          e.type === "send"
            ? "Send"
            : e.options && !e.respondSend
              ? "Need Response"
              : "Incoming",
        );
        if (e.from === "acars") e.from = "";
        e.viewed = e.type === "send";
        this.messages.insert(e, 0);
      });
    this.props.gtcService.bus
      .getSubscriber()
      .on("acars_message_read_state")
      .handle((e) => {
        const index = this.messages
          .getArray()
          .findIndex((msg) => e.id === msg._id);
        if (index === -1) return;
        const message = this.messages.getArray()[index];

        if (e.state === "Deleted") {
          this.messages.removeAt(index);
          return;
        }

        message.state.set(e.state);
        message.viewed = true;
        if (e.state === "Closed") message.respondSend = e.option;
      });
  }
  onResume() {
    // for (const sub of this.subscriptions) {
    //   sub.resume(true);
    // }
  }
  /** @inheritDoc */
  onPause() {
    // for (const sub of this.subscriptions) {
    //   sub.pause();
    // }
  }
  onAfterRender(thisNode) {
    this.thisNode = thisNode;
  }
  onGtcInteractionEvent() {
    return false;
  }
  stateBtnPressed() {}
  renderItem(message) {
    const content =
      message.content.length < 21
        ? message.content
        : `${message.content.substr(0, 21)}...`;

    // Icon part
    const getIcon = (s) => {
      if (s.includes("Closed")) return `${BASE}/dl_closed.svg`;
      if (s.includes("Incoming") || s.includes("Need Response"))
        return `${BASE}/ul_need_response_unread.svg`;
      if (s.includes("Send")) return `${BASE}/dl_sent.svg`;
      return `${BASE}/ul_need_response_read.svg`;
    };
    // Unread effect part
    const cssClass = SetSubject.create(["message-item"]);

    if (message.type !== "send" && message.state.get() === "Incoming") {
      cssClass.add("unread-effect");
    }

    message.state.sub((s) => {
      if (message.type !== "send" && s === "Incoming") {
        cssClass.add("unread-effect");
      } else {
        cssClass.delete("unread-effect");
      }
    });

    return (
      <GtcListItem class={"message-list-item"} hideBorder>
        <GtcTouchButton
          onPressed={() => {
            this.props.gtcService
              .openPopup("ACARS_MESSAGE_PAGE", "normal", "hide")
              .ref.openMessage(message);
          }}
          isInList={true}
          class={cssClass}
        >
          <div class="text-block">
            <span>{content}</span>
          </div>
          <div class="status-row">
            <span class="state-with-icon">
              <img
                class="cpdlc-state-icon"
                src={message.state.map((s) => getIcon(s))}
                alt=""
              />
              {message.state}
            </span>
            <span>{message.from}</span>
            <span>
              <span class={"strong"}>{convertUnixToHHMM(message.ts)}</span>
              <span class={"small"}>UTC</span>
            </span>
          </div>
        </GtcTouchButton>
      </GtcListItem>
    );
  }
  render() {
    const sidebarState = Subject.create(null);
    return (
      <div class={"acars-page-cpdlc-tab"}>
        <GtcList
          ref={this.listRef}
          listItemSpacingPx={1}
          sidebarState={sidebarState}
          bus={this.bus}
          data={this.messages}
          renderItem={this.renderItem.bind(this)}
          listItemHeightPx={this.listItemHeight}
        />
      </div>
    );
  }
}

// Requested data groups are the same for every ADS-C contract
const ADSC_REQUEST_DATA_GROUPS = [
  "Basic ADS",
  "Earth Reference",
  "Air Reference",
  "Airframe ID",
];

class AdscTab extends DisplayComponent {
  constructor() {
    super(...arguments);
    this.listRef = FSComponent.createRef();
    this.listItemHeight =
      this.props.gtcService.orientation === "horizontal" ? 130 : 70;

    // List of known OCA stations
    this.oca = {
      BIRD: "Reykjavik",
      ENOB: "Bodo",
      BGGL: "Nuuk",
      EGGX: "Shanwick",
      CZQX: "Gander",
      KZWY: "New York",
      LPPO: "Santa Maria",
      KZAK: "San Francisco",
      NZZO: "Auckland",
      NZCM: "McMurdo",
      NFFF: "Nadi",
      NTTT: "Tahiti",
      YBBB: "Brisbane",
      YMMM: "Melbourne",
      RJTG: "Tokyo",
      MMFO: "Mazatlan",
      PAZN: "Anchorage",
    };

    this.enabledAdsc = Subject.create(false);
    this.enabledAdscEmergMode = Subject.create(false);
    this.adscReportTimer = null;
    this.activeContracts = ArraySubject.create();
    this.hasContracts = Subject.create(false);

    this.adscEnabledSub = this.props.gtcService.bus
      .getSubscriber()
      .on("acars_adsc_enabled")
      .handle((e) => {
        this.enabledAdsc.set(e.enabled);
        if (window.acarsSide !== "primary") return;
        const client = this.props.client.get();
        if (client && client.setAdscEnabled) client.setAdscEnabled(e.enabled);
        if (e.enabled) {
          this.startAdscReportLoop();
        } else {
          this.stopAdscReportLoop();
          if (client && client.rejectAdsc) client.rejectAdsc();
        }
      });

    this.adscContractsSub = this.props.gtcService.bus
      .getSubscriber()
      .on("acars_adsc_contracts")
      .handle((e) => this.updateContractList(e.contracts));

    this.clientSub = this.props.client.sub((client) => {
      if (window.acarsSide !== "primary") return;
      if (!client) {
        this.publishAdscContracts({});
        return;
      }
      if (client.setAdscEnabled) client.setAdscEnabled(this.enabledAdsc.get());
      client._adscCallback = (contracts) =>
        this.publishAdscContracts(contracts);
      this.publishAdscContracts(client.adsc_contracts);
    }, true);
  }

  publishAdscEnabled(enabled) {
    this.props.gtcService.bus
      .getPublisher()
      .pub("acars_adsc_enabled", { enabled }, true, true);
  }

  publishAdscContracts(contracts) {
    this.props.gtcService.bus
      .getPublisher()
      .pub("acars_adsc_contracts", { contracts: contracts || {} }, true, true);
  }

  updateContractList(contracts) {
    const items = Object.keys(contracts || {}).map((station) => {
      const contract = contracts[station];
      return {
        station,
        name: this.oca[station] ?? station ?? "ZZZZ",
        contract_type: contract.type,
        report_period: contract.interval,
        next_report: null,
        request_data_group: ADSC_REQUEST_DATA_GROUPS,
        lastReportTime: contract.lastReportTime,
      };
    });
    this.activeContracts.set(items);
    this.hasContracts.set(items.length > 0);
  }

  startAdscReportLoop() {
    if (this.adscReportTimer) return;
    this.adscReportTimer = setInterval(() => this.sendDueAdscReports(), 1000);
  }

  stopAdscReportLoop() {
    if (this.adscReportTimer) {
      clearInterval(this.adscReportTimer);
      this.adscReportTimer = null;
    }
  }

  sendDueAdscReports() {
    const client = this.props.client.get();
    if (!this.enabledAdsc.get() || !client || !client.adsc_contracts) return;
    const now = Date.now();
    let sent = false;
    for (const station of Object.keys(client.adsc_contracts)) {
      const contract = client.adsc_contracts[station];
      if (contract.type !== "periodic") continue;
      if (
        contract.lastReportTime === null ||
        now - contract.lastReportTime >= contract.interval * 1000
      ) {
        contract.lastReportTime = now;
        this.adscContract(station);
        sent = true;
      }
    }
    // Broadcast updated lastReportTime so "Next Report" stays accurate
    if (sent) this.publishAdscContracts(client.adsc_contracts);
  }

  onResume() {
    // for (const sub of this.subscriptions) {
    //   sub.resume(true);
    // }
  }
  /** @inheritDoc */
  onPause() {
    // for (const sub of this.subscriptions) {
    //   sub.pause();
    // }
  }
  onAfterRender(thisNode) {
    this.thisNode = thisNode;
  }
  onGtcInteractionEvent() {
    return false;
  }
  stateBtnPressed() {}

  destroy() {
    this.stopAdscReportLoop();
    if (this.adscEnabledSub) this.adscEnabledSub.destroy();
    if (this.adscContractsSub) this.adscContractsSub.destroy();
    if (this.clientSub) this.clientSub.destroy();
    super.destroy();
  }

  async openEmergDialog() {
    const result = await this.props.gtcService
      .openPopup(GtcViewKeys.MessageDialog1)
      .ref.request({
        message: `Initiate ADS-C Emergency Mode?`,
        showRejectButton: true,
        acceptButtonLabel: "OK",
        rejectButtonLabel: "Cancel",
      });

    if (result.wasCancelled || result.payload !== true) return;

    this.enabledAdscEmergMode.set(true);
  }

  async disableAdsc() {
    const result = await this.props.gtcService
      .openPopup(GtcViewKeys.MessageDialog1)
      .ref.request({
        message: `Terminate all ADS-C connections and contracts?`,
        showRejectButton: true,
        acceptButtonLabel: "OK",
        rejectButtonLabel: "Cancel",
      });

    if (result.wasCancelled || result.payload !== true) return;

    this.publishAdscEnabled(false);
  }

  async adscContract(station) {
    try {
      const client = this.props.client.get();
      if (!client) return false;

      const latRad = SimVar.GetSimVarValue("PLANE LATITUDE", "radians");
      const lonRad = SimVar.GetSimVarValue("PLANE LONGITUDE", "radians");
      const altFt = SimVar.GetSimVarValue("PLANE ALTITUDE", "feet");
      const headingMagRad = SimVar.GetSimVarValue(
        "PLANE HEADING DEGREES MAGNETIC",
        "radians",
      );
      const gs = Math.round(SimVar.GetSimVarValue("GROUND VELOCITY", "knots"));

      const lat = (latRad * (180 / Math.PI)).toFixed(5);
      const lon = (lonRad * (180 / Math.PI)).toFixed(5);
      const alt = altFt.toFixed(0);
      const hdg = Math.round(
        (((headingMagRad * (180 / Math.PI)) % 360) + 360) % 360,
      );

      return await client.sendAdsc(station, lat, lon, alt, hdg, gs);
    } catch {
      return false;
    }
  }

  renderContractItem(contract) {
    return (
      <GtcListItem hideBorder>
        <GtcTouchButton
          class={"acars-settings-button"}
          label={`Connection with ${contract.station}`}
          isInList={true}
          onPressed={() => {
            // Compute "Next Report" at open time so it is always current
            const item = { ...contract };
            if (item.report_period != null) {
              const elapsed =
                item.lastReportTime != null
                  ? (Date.now() - item.lastReportTime) / 1000
                  : item.report_period;
              item.next_report = Math.max(0, item.report_period - elapsed);
            }
            this.props.gtcService
              .openPopup("ADSC_CONTRACT", "normal", "hide")
              .ref.openForm(item);
          }}
        />
      </GtcListItem>
    );
  }

  render() {
    const sidebarState = Subject.create(null);
    return (
      <div class="acars-page-adsc-tab">
        <div class="top-row">
          <GtcToggleTouchButton
            label="ADS-C Enabled"
            class="left-col"
            state={this.enabledAdsc}
            onPressed={() => {
              if (this.enabledAdsc.get()) {
                this.disableAdsc();
              } else {
                this.publishAdscEnabled(true);
              }
            }}
            isInList
            gtcOrientation={this.props.gtcService.orientation}
          />

          <GtcToggleTouchButton
            label="Emergency Mode"
            class="right-col"
            state={this.enabledAdscEmergMode}
            onPressed={() => {
              if (!this.enabledAdscEmergMode.get()) {
                this.openEmergDialog();
              } else {
                this.enabledAdscEmergMode.set(!this.enabledAdscEmergMode.get());
              }
            }}
            isInList
            gtcOrientation={this.props.gtcService.orientation}
          />
        </div>

        <div class="main-panel">
          <span
            class="empty-message"
            style={{
              display: this.hasContracts.map((e) => (e ? "none" : "block")),
            }}
          >
            No Active Connections
          </span>
          <GtcList
            class={"acars-adsc-items"}
            ref={this.listRef}
            listItemSpacingPx={1}
            sidebarState={sidebarState}
            bus={this.bus}
            data={this.activeContracts}
            renderItem={this.renderContractItem.bind(this)}
            itemsPerPage={4}
            listItemHeightPx={this.listItemHeight}
          />
        </div>
      </div>
    );
  }
}

class AcarsMessagePage extends GtcView {
  comSpacingModeSetting = ComRadioUserSettings.getManager(
    this.props.gtcService.bus,
  ).getSetting("comRadioSpacing");
  COM_25_FORMATTER = RadioFrequencyFormatter.createCom(ComSpacing.Spacing25Khz);
  COM_833_FORMATTER = RadioFrequencyFormatter.createCom(
    ComSpacing.Spacing833Khz,
  );

  constructor(props) {
    super(props);
    this.message = Subject.create(null);
    this.canReply = Subject.create(true);
    this.messageListRef = FSComponent.createRef();
    this.contentRef = FSComponent.createRef();
    this.from = Subject.create("");
    this.content = Subject.create("");
    this.itemHeight = Subject.create(0);
    this.option1 = Subject.create(null);
    this.option2 = Subject.create(null);
    this.option3 = Subject.create(null);
    this.sizeInterval = null;

    this.directToWaypoint = null;
    this.contactFrequency = null;
    this.contactLabel = Subject.create("");
    this.hasWilco = Subject.create(false);
    this.showFreqBtn = Subject.create(false);
    this.selectedResponse = Subject.create("WILCO");
  }

  startSizeMonitor() {
    if (this.sizeInterval) return;
    this.sizeInterval = setInterval(() => {
      const elem = this.contentRef.getOrDefault();
      if (!elem) return;
      const height = elem.getBoundingClientRect().height + 60;
      if (this.itemHeight.get() !== height) this.itemHeight.set(height);
    }, 250);
  }

  stopSizeMonitor() {
    if (this.sizeInterval) {
      clearInterval(this.sizeInterval);
      this.sizeInterval = null;
    }
  }

  nextFreqButton(message) {
    this.contactFrequency = null;
    this.contactLabel.set("");
    this.showFreqBtn.set(false);

    const freq = extractContactFrequency(message.content);
    if (freq !== null && message.type !== "send") {
      this.contactFrequency = freq;

      const labelMatch = message.content.match(
        /(?:CONTACT|MONITOR)\s+(.+?)\s+(?:ON\s+)?\d{3}\.\d{1,3}/i,
      );

      const labelMatchAt = message.content.match(
        /(?:CONTACT|MONITOR)\s+(.+?)\s*@\d{3}\.\d{1,3}@/i,
      );

      this.contactLabel.set(
        labelMatch
          ? labelMatch[1].trim()
          : labelMatchAt
            ? labelMatchAt[1].trim()
            : "",
      );
      this.showFreqBtn.set(true);
    }
  }

  directToButton(message) {
    const directToMatch = message.content.match(
      /PROCEED\s+DIRECT\s+(?:TO\s+)?([A-Z]{2,5})/i,
    );

    if (directToMatch && message.type !== "send") {
      const waypoint = directToMatch[1].trim();

      this.directToWaypoint = waypoint;
    }
  }

  async openDirectToDialog() {
    if (!this.directToWaypoint) return;
    const waypoint = this.directToWaypoint;

    const result = await this.props.gtcService
      .openPopup(GtcViewKeys.MessageDialog1)
      .ref.request({
        message: "Import to Direct To page?",
        showRejectButton: true,
        acceptButtonLabel: "Yes",
        rejectButtonLabel: "No",
      });

    if (result.wasCancelled || result.payload !== true) return;

    const plan = this.props.fms.getPrimaryFlightPlan();
    let segmentIndex = undefined;
    let segmentLegIndex = undefined;

    for (let s = 0; s < plan.segmentCount; s++) {
      const segment = plan.getSegment(s);
      for (let l = 0; l < segment.legs.length; l++) {
        if (segment.legs[l].name === waypoint) {
          segmentIndex = s;
          segmentLegIndex = l;
          break;
        }
      }
      if (segmentIndex !== undefined) break;
    }

    let facility = null;
    if (segmentIndex === undefined) {
      try {
        const lat = SimVar.GetSimVarValue("PLANE LATITUDE", "degrees");
        const lon = SimVar.GetSimVarValue("PLANE LONGITUDE", "degrees");
        
        const results =
          await this.props.fms.facLoader.findNearestFacilitiesByIdent(
            FacilitySearchType.AllExceptVisual,
            waypoint,
            lat,
            lon,
            1,
          );
        if (results && results.length > 0) facility = results[0];
      } catch (error) {
        console.error("Error searching direct to facility:", error);
      }
    }

    const directToPage = this.props.gtcService.changePageTo(
      GtcViewKeys.DirectTo,
    );

    if (segmentIndex !== undefined) {
      directToPage.ref.setWaypoint({ segmentIndex, segmentLegIndex });
    } else {
      directToPage.ref.setWaypoint(facility ? { facility } : {});
    }
  }

  openMessage(message) {
    this.hasWilco.set(!!message.respondSend);

    this.nextFreqButton(message);
    this.directToButton(message);

    this.message.set(message);
    this.from.set(message.from);
    this.content.set(message.content);
    this.canReply.set(message.options && !message.respondSend);
    if (message.options && !message.respondSend) {
      const arr = [this.option1, this.option2, this.option3];
      message.options.forEach((v, i) => arr[i].set(v));
      this.bus.getPublisher().pub(
        "cas_deactivate_alert",
        {
          key: { uuid: "cpdlc-msg" },
          priority: AnnunciationType.Advisory,
        },
        true,
        false,
      );
    } else {
      if (!message.viewed && message.type !== "send") {
        this.bus.getPublisher().pub(
          "acars_message_read_state",
          {
            id: message._id,
            state: "Viewed",
          },
          true,
          false,
        );
        this.bus.getPublisher().pub(
          "cas_deactivate_alert",
          {
            key: { uuid: message.cpdlc ? "cpdlc-msg" : "acars-msg" },
            priority: AnnunciationType.Advisory,
          },
          true,
          false,
        );
      }
    }

    message.viewed = true;
  }
  onResume() {
    this.startSizeMonitor();
  }

  onPause() {
    this.stopSizeMonitor();
  }

  destroy() {
    this.stopSizeMonitor();
    const value = this.messageListRef.getOrDefault();
    if (value) value.destroy();
    super.destroy();
  }

  onAfterRender(thisNode) {
    this.thisNode = thisNode;
    this._title.set("CPDLC Thread");
    this.startSizeMonitor();
  }
  optionsItem(option) {
    const e = option.get();
    const message = this.message.get();
    if (message.respondSend) return;

    if (window.acarsSide === "primary") message.response(e);
    else
      this.props.gtcService.bus.getPublisher().pub(
        "acars_message_ack",
        {
          e,
          id: message._id,
        },
        true,
        false,
      );
    this.bus.getPublisher().pub(
      "acars_message_read_state",
      {
        id: message._id,
        state: "Closed",
        option: e,
      },
      true,
      false,
    );
    this.message.set(message);
    this.canReply.set(false);
    const arr = [this.option1, this.option2, this.option3];
    message.options.forEach((v, i) => arr[i].set(v === e ? e : null));

    if (e === "WILCO") {
      this.hasWilco.set(true);
      const action =
        this.contactFrequency !== null
          ? () => this.openLoadFreqDialog()
          : this.directToWaypoint !== null
            ? () => this.openDirectToDialog()
            : null;
      if (action) setTimeout(action, 300);
    }
  }
  async openLoadFreqDialog() {
    if (this.contactFrequency === null) return;

    const result = await this.props.gtcService
      .openPopup(GtcViewKeys.MessageDialog1)
      .ref.request({
        message: "Choose radio to tune?",
        showRejectButton: true,
        acceptButtonLabel: "Yes",
        rejectButtonLabel: "No",
      });

    if (result.wasCancelled || result.payload !== true) return;

    const comSpacing =
      this.comSpacingModeSetting.value ===
      ComRadioSpacingSettingMode.Spacing8_33Khz
        ? ComSpacing.Spacing833Khz
        : ComSpacing.Spacing25Khz;
    const formatter =
      comSpacing === ComSpacing.Spacing833Khz
        ? this.COM_833_FORMATTER
        : this.COM_25_FORMATTER;

    await this.props.gtcService
      .openPopup(GtcViewKeys.LoadFrequencyDialog)
      .ref.request({
        type: "COM",
        comChannelSpacing: comSpacing,
        frequency: this.contactFrequency,
        label: this.contactLabel.get(),
      });
  }

  render() {
    const sidebarState = Subject.create(null);
    return (
      <div class={"acars-message-page"}>
        <GtcList
          class={"content-list"}
          ref={this.messageListRef}
          listItemSpacingPx={12}
          itemsPerPage={3}
          sidebarState={sidebarState}
          bus={this.bus}
          listItemHeightPx={this.itemHeight}
          heightPx={
            this.props.gtcService.orientation === "horizontal" ? 380 : 260
          }
        >
          <GtcListItem hideBorder>
            <div class={`content content-from`}>
              <span ref={this.contentRef}>{this.content}</span>
              <br />
              <span>
                <span class={"strong"}>{convertUnixToHHMM(Date.now())}</span>
                <span class={"small"}>UTC</span>
              </span>
            </div>
          </GtcListItem>
          <GtcListItem hideBorder>
            <div class="answer-wrapper">
              <GtcListSelectTouchButton
                class="content answer"
                gtcService={this.props.gtcService}
                listDialogKey={GtcViewKeys.ListDialog1}
                state={this.selectedResponse}
                label="Response"
                renderValue={(v) => v}
                onSelected={(v) => this.selectedResponse.set(v.get())}
                listParams={{
                  title: "Response",
                  inputData: [this.option1, this.option2].map((op) => ({
                    value: op,
                    labelRenderer: () => op.get(),
                  })),
                }}
                isInList={true}
                isVisible={this.canReply}
              />
            </div>
          </GtcListItem>
        </GtcList>
        <div class={"options"}>
          {/* Standby */}
          <GtcTouchButton
            onPressed={async () => this.optionsItem(this.option3)}
            class={"btn"}
            label={"Standby"}
            isVisible={this.canReply}
          />
          {/* Delete */}
          <GtcTouchButton
            onPressed={async () => {
              const message = this.message.get();
              this.bus
                .getPublisher()
                .pub(
                  "acars_message_read_state",
                  { id: message._id, state: "Deleted" },
                  true,
                  false,
                );
              this.props.gtcService.goBack();
            }}
            class={"btn"}
            label={"Delete"}
            isVisible={this.canReply.map((v) => !v)}
          />
          {/* Send */}
          <GtcTouchButton
            onPressed={async () => this.optionsItem(this.selectedResponse)}
            class={"btn"}
            label={"Send"}
            isVisible={this.canReply}
          />
          {/* Import */}
          <GtcTouchButton
            onPressed={async () => {
              if (this.contactFrequency) {
                await this.openLoadFreqDialog();
              } else if (this.directToWaypoint) {
                await this.openDirectToDialog();
              }
            }}
            class={"btn"}
            label={"Import"}
            isVisible={this.canReply.map(
              (v) =>
                !v &&
                (this.contactFrequency !== null ||
                  this.directToWaypoint !== null),
            )}
          />
        </div>
      </div>
    );
  }
}
class AcarsSendTemplate extends GtcView {
  constructor(props) {
    super(props);
    this.listRef = FSComponent.createRef();
    this.itemListRef = FSComponent.createRef();

    this.buttonText = Subject.create("Send");
    this.itemTitle = Subject.create("-");
    this.listItemHeight =
      this.props.gtcService.orientation === "horizontal" ? 130 : 70;
    this.dataMaps = ObjectSubject.create({});
    this.fields = ArraySubject.create();
    this.option = Subject.create({});
    this.valid = Subject.create(false);
  }
  destroy() {
    let value = this.listRef.getOrDefault();
    if (value) value.destroy();
    value = this.itemListRef.getOrDefault();
    if (value) value.destroy();
    this.clearOld();
    super.destroy();
  }
  onPause() {}
  onAfterRender() {
    this._title.set("Select Message");
  }
  renderItem(e, i) {
    return (
      <GtcListItem>
        {e.options ? (
          <GtcListSelectTouchButton
            isInList={true}
            class={"item"}
            gtcService={this.props.gtcService}
            listDialogKey={GtcViewKeys.ListDialog1}
            state={this[`field_${e.name}`]}
            label={e.name}
            renderValue={(v) =>
              v ? (v.length > 1 ? v[1] : v[0]) : e.displayFallback || "----"
            }
            onSelected={(v) => {
              this[`field_${e.name}`].set(v);
              this.runValidCheck();
            }}
            listParams={{
              title: e.name,
              inputData: e.options.map((x) => ({
                value: x,
                labelRenderer: () => (x.length > 1 ? x[1] : x[0]),
              })),
            }}
          />
        ) : (
          <GtcValueTouchButton
            class={"item"}
            state={this[`field_${e.name}`]}
            label={e.name}
            renderValue={
              e.renderValue
                ? (v) => (v ? e.renderValue(v) : e.displayFallback || "----")
                : (v) => (v ? v : e.displayFallback || "----")
            }
            onPressed={async () => {
              if (e.type === "ACARS_ENTRY_ALTITUDE") {
                const current = this[`field_${e.name}`].get();
                const result = await this.props.gtcService
                  .openPopup("ACARS_ENTRY_ALTITUDE", "normal", "hide")
                  .ref.request({
                    initialAltitudeFeet: current?.altitudeFeet ?? 0,
                    isFlightLevel: current?.isFlightLevel ?? true,
                    title: "Altitude Entry",
                  });
                if (result.wasCancelled) return;
                this[`field_${e.name}`].set(result.payload);
                this.runValidCheck();
                return;
              }

              let result = await this.props.gtcService
                .openPopup(e.type, "normal", "hide")
                .ref.request({
                  label: e.name,
                  allowSpaces: e.allowSpaces || false,
                  maxLength: e.maxLength || 4,
                  initialValue: this[`field_${e.name}`].get(),
                  initialInputText: this[`field_${e.name}`].get(),
                });
              if (result.wasCancelled) return;

              this[`field_${e.name}`].set(
                e.transform ? e.transform(result.payload) : result.payload,
              );
              this.runValidCheck();

              let x = e;
              let inc = 0;
              while (
                x.name.includes("Remarks") &&
                result.payload.length === 12
              ) {
                if (x.c === this.option.get().freeTextCount) break;
                x = this.fields.getArray()[i + ++inc];
                result = await this.props.gtcService
                  .openPopup(x.type, "normal", "hide")
                  .ref.request({
                    label: x.name,
                    allowSpaces: x.allowSpaces || false,
                    maxLength: x.maxLength || 4,
                    initialValue: this[`field_${x.name}`].get(),
                    initialInputText: this[`field_${x.name}`].get(),
                  });
                if (result.wasCancelled) return;
                this[`field_${x.name}`].set(
                  e.transform ? e.transform(result.payload) : result.payload,
                );
                this.runValidCheck();
              }
            }}
            isInList={true}
          />
        )}
      </GtcListItem>
    );
  }
  runValidCheck() {
    const option = this.option.get();
    let valid = true;
    for (const e of option.fields) {
      const v = this[`field_${e.name}`].get();
      if (e.validate && !e.validate(Array.isArray(v) ? v[0] : v)) {
        valid = false;
        break;
      }
    }
    this.valid.set(valid);
  }
  clearOld() {
    const option = this.option.get();
    if (!option) return;
    if (option.freeText) {
      for (let i = 0; i < option.freeTextCount; i++) {
        delete this[`field_Remarks ${i + 1}`];
      }
    }
    for (const e of option.fields) {
      delete this[`field_${e.name}`];
    }
    this.option.set(null);
    this.fields.clear();
  }
  openForm(opt) {
    opt.fields.forEach((e) => {
      this[`field_${e.name}`] = Subject.create(
        (typeof e.initialValue === "function"
          ? e.initialValue()
          : e.initialValue) || "",
      );
    });
    this.option.set(opt);
    this.fields.clear();
    this.fields.insertRange(0, opt.fields);
    if (opt.freeText) {
      for (let i = 0; i < opt.freeTextCount; i++) {
        this[`field_Remarks ${i + 1}`] = Subject.create("");
        this.fields.insert({
          name: `Remarks ${i + 1}`,
          allowSpaces: true,
          maxLength: 12,
          c: i + 1,
          initialValue: "",
          displayFallback: "___",
          type: GtcViewKeys.TextDialog,
        });
      }
    }
    this.itemTitle.set(opt.title);
  }
  render() {
    const sidebarState = Subject.create(null);
    return (
      <div class={"acars-message-dialog acars-message-dialog-popup"}>
        <div class={"header"}>
          <span>{this.itemTitle}</span>
        </div>
        <GtcList
          class={"list"}
          ref={this.listRef}
          listItemSpacingPx={5}
          sidebarState={sidebarState}
          bus={this.bus}
          data={this.fields}
          listItemHeightPx={this.listItemHeight}
          renderItem={this.renderItem.bind(this)}
        />
        <div class={"footer"}>
          <div class={"status-row"}>
            <span>
              {this.props.client.map(
                (c) => c?.active_station ?? "Facility Unknown",
              )}
            </span>
            <span>
              <span class={"strong"}>{convertUnixToHHMM(Date.now())}</span>
              <span class={"small"}>UTC</span>
            </span>
          </div>
          <GtcTouchButton
            label={this.buttonText}
            isEnabled={this.valid}
            onPressed={async () => {
              const opt = this.option.get();
              if (!opt.onSend) {
                this.props.gtcService.goBack();
              } else {
                this.buttonText.set("Sending");
                const f = Object.values(opt.fields)
                  .map((e) => [e.name, this[`field_${e.name}`]])
                  .reduce((acc, val) => {
                    acc[val[0]] = val[1].get();
                    if (Array.isArray(acc[val[0]]))
                      acc[val[0]] = acc[val[0]][0];
                    return acc;
                  }, {});
                if (opt.freeText) {
                  f["FreeText"] = Array(opt.freeTextCount)
                    .fill()
                    .map((_, i) => this[`field_Remarks ${i + 1}`].get())
                    .filter((e) => e.length > 0)
                    .join("");
                }
                const res = await opt.onSend(f);
                if (res) {
                  this.props.gtcService.goBack();
                  this.props.gtcService.goBack();
                } else this.buttonText.set("Failed to send");
              }
            }}
          />
        </div>
      </div>
    );
  }
}

class AdscContract extends GtcView {
  constructor(props) {
    super(props);

    this.station = Subject.create("----");
    this.stationName = Subject.create("----");
    this.contractType = Subject.create("----");
    this.reportPeriod = Subject.create("----");
    this.nextReport = Subject.create("----");
    this.requestData = Subject.create("----");
    this.groupsText = Subject.create("");
  }

  onPause() {}

  onAfterRender() {
    this._title.set("Connection Details");
  }

  onGtcInteractionEvent() {
    return false;
  }

  openForm(contract) {
    this.station.set(contract.station ?? "----");
    this.stationName.set(contract.name ?? "----");

    const type = contract.contract_type ?? "----";
    this.contractType.set(type.charAt(0).toUpperCase() + type.slice(1));

    this.reportPeriod.set(
      contract.report_period != null
        ? `${Math.round(contract.report_period / 60)} minutes`
        : "----",
    );

    this.nextReport.set(
      contract.next_report != null
        ? `${Math.round(contract.next_report / 60)} minutes`
        : "----",
    );

    const groups = Array.isArray(contract.request_data_group)
      ? contract.request_data_group
      : [];
    this.groupsText.set(groups.join("\n"));
  }

  renderRow(label, valueSubject) {
    return (
      <div class="adsc-contract-row">
        <span class="adsc-contract-label">{label}</span>
        <span class="adsc-contract-value">{valueSubject}</span>
      </div>
    );
  }

  render() {
    return (
      <div class="acars-adsc-contract-page">
        <div class="adsc-contract-mode-title">
          <span>Normal Mode</span>
        </div>

        <div class="adsc-contract-row adsc-contract-row-multiline">
          <span class="adsc-contract-label">Recipient Facilities:</span>
          <div class="adsc-contract-value-col">
            <span class="adsc-contract-value adsc-contract-value-big">
              {this.station}
            </span>
            <span class="adsc-contract-value adsc-contract-value-small uppercase">
              {this.stationName}
            </span>
          </div>
        </div>

        {this.renderRow("Contract Type(s):", this.contractType)}
        {this.renderRow("Report Period:", this.reportPeriod)}
        {this.renderRow("Next Report:", this.nextReport)}

        <div class="adsc-contract-row adsc-contract-row-multiline">
          <span class="adsc-contract-label">{"Requested Data\nGroup(s):"}</span>
          <div class="adsc-contract-value-col">
            <span class="adsc-contract-value" style="white-space: pre-line;">
              {this.groupsText}
            </span>
          </div>
        </div>
      </div>
    );
  }
}
class AcarsSettingsPopUp extends GtcView {
  constructor(props) {
    super(props);
    this.listRef = FSComponent.createRef();
    this.listItemHeight =
      this.props.gtcService.orientation === "horizontal" ? 130 : 70;
    this.hoppieValue = Subject.create(
      this.props.settingsManager.getSetting("acars_code").get(),
    );
    this.networkValue = Subject.create(
      this.props.settingsManager.getSetting("network").get(),
    );
    this.simbriefId = Subject.create(
      this.props.settingsManager.getSetting("g3ka_simbrief_id").get(),
    );
  }
  destroy() {
    const value = this.listRef.getOrDefault();
    if (value) value.destroy();
    super.destroy();
  }
  render() {
    const sidebarState = Subject.create(null);
    return (
      <GtcList
        class={"acars-settings acars-settings-popup"}
        ref={this.listRef}
        listItemSpacingPx={1}
        sidebarState={sidebarState}
        bus={this.bus}
        itemsPerPage={5}
        listItemHeightPx={this.listItemHeight}
      >
        <GtcListItem>
          <GtcValueTouchButton
            class={"acars-settings-button"}
            label={"Hoppie Code"}
            renderValue={(v) => (v && v.length ? v : "----")}
            state={this.hoppieValue}
            isInList={true}
            onPressed={async () => {
              const iff = document.createElement("input");
              iff.style.position = "absolute";
              iff.style.opacity = 0;
              document.body.appendChild(iff);
              iff.focus();
              const id = `${Date.now()}--hoppie-input`;
              Coherent.trigger("FOCUS_INPUT_FIELD", id, "", "", "", false);

              const result = await this.props.gtcService
                .openPopup(GtcViewKeys.MessageDialog1)
                .ref.request({
                  message: "Paste now to set Hoppie code, then press Okay",
                });
              Coherent.trigger("UNFOCUS_INPUT_FIELD", id);
              this.hoppieValue.set(iff.value);
              this.props.settingsManager
                .getSetting("acars_code")
                .set(iff.value);
              SetStoredData("hoppie_code", iff.value);
              iff.remove();
            }}
          />
        </GtcListItem>
        <GtcListItem>
          <GtcValueTouchButton
            class={"acars-settings-button"}
            label={"Simbrief Id"}
            renderValue={(v) => (v && v.length ? v : "----")}
            state={this.simbriefId}
            isInList={true}
            onPressed={async () => {
              const result = await this.props.gtcService
                .openPopup(GtcViewKeys.TextDialog, "normal", "hide")
                .ref.request({
                  label: "Simbrief Id",
                  allowSpaces: false,
                  maxLength: 10,
                  initialValue: this.simbriefId.get(),
                  initialInputText: this.simbriefId.get(),
                });
              if (!result.wasCancelled) {
                this.simbriefId.set(result.payload);
                this.props.settingsManager
                  .getSetting("g3ka_simbrief_id")
                  .set(result.payload);
                SetStoredData("g3ka_simbrief_id", result.payload);
              }
            }}
          />
        </GtcListItem>
        <GtcListItem>
          <GtcListSelectTouchButton
            isInList={true}
            class={"acars-settings-button"}
            gtcService={this.props.gtcService}
            listDialogKey={GtcViewKeys.ListDialog1}
            state={this.networkValue}
            label={"Network"}
            onSelected={(v) => {
              this.networkValue.set(v);
              this.props.settingsManager.getSetting("network").set(v);
              SetStoredData("g3ka_network", v);
            }}
            listParams={{
              title: "Network",
              inputData: [
                { value: "hoppie", labelRenderer: () => "Hoppie" },
                {
                  value: "sayintentions",
                  labelRenderer: () => "SayIntentions",
                },
                { value: "beyondatc", labelRenderer: () => "BeyondATC" },
              ],
            }}
          />
        </GtcListItem>
      </GtcList>
    );
  }
}

class AcarsMessageSendList extends GtcView {
  constructor(props) {
    super(props);
    this.listRef = FSComponent.createRef();
    this.listItemHeight =
      this.props.gtcService.orientation === "horizontal" ? 130 : 70;
  }
  destroy() {
    const value = this.listRef.getOrDefault();
    if (value) value.destroy();
    super.destroy();
  }
  onAfterRender() {
    this._title.set("Select Message");
  }
  render() {
    const sidebarState = Subject.create(null);
    return (
      <GtcList
        class={"acars-settings acars-settings-popup"}
        ref={this.listRef}
        listItemSpacingPx={1}
        sidebarState={sidebarState}
        bus={this.bus}
        itemsPerPage={5}
        listItemHeightPx={this.listItemHeight}
      >
        {this.props.items.map((e) => (
          <GtcListItem key={e.title}>
            <GtcTouchButton
              class={"acars-settings-button"}
              label={e.title}
              isInList={true}
              onPressed={() => {
                this.props.gtcService
                  .openPopup("ACARS_SEND", "normal", "hide")
                  .ref.openForm(e);
              }}
            />
          </GtcListItem>
        ))}
      </GtcList>
    );
  }
}

class AcarsTabView extends GtcView {
  constructor(props) {
    super(props);

    this.tabsRef = FSComponent.createRef();
    this.subscriptions = [];
    this.settingsManager = new DefaultUserSettingManager(this.bus, [
      {
        defaultValue: GetStoredData("hoppie_code"),
        name: "acars_code",
      },
      {
        defaultValue: GetStoredData("g3ka_simbrief_id"),
        name: "g3ka_simbrief_id",
      },
      {
        defaultValue: GetStoredData("g3ka_network") || "hoppie",
        name: "network",
      },
    ]);
    const isPrimary = window.acarsSide !== "secondary";
    this.isPrimary = isPrimary;
    this.canCreate = Subject.create(false);
    this.client = Subject.create(null);
    this.distance = Subject.create(null);
    this.groundSpeed = Subject.create(null);
    if (isPrimary) {
      window.acarsSide = "primary";
      this.props.gtcService.bus
        .getPublisher()
        .pub("acars_instance_create", {}, true, false);
    }
    this.latestMessage = Subject.create(null);
    this.unreadCount = Subject.create(0);
    this.cpdlcTabLabel = Subject.create("CPDLC");
    this.adscTabLabel = Subject.create("ADS-C");
    this.subscriptions.push(
      this.props.gtcService.bus
        .getSubscriber()
        .on("acars_message_read_state")
        .handle((e) => {
          if (e.state === "Viewed" || e.state === "Closed") {
            const count = Math.max(0, this.unreadCount.get() - 1);
            this.unreadCount.set(count);
            this.cpdlcTabLabel.set(count > 0 ? `CPDLC\n(${count})` : "CPDLC");
          }
        }),
    );
    const now = new Date();
    this.depTime = Subject.create(now.getUTCHours() * 60 + now.getUTCMinutes());
    this.subscriptions.push(
      this.props.gtcService.bus
        .getSubscriber()
        .on("lnavdata_waypoint_distance")
        .handle((v) => {
          this.distance.set(v);
        }),
    );
    this.subscriptions.push(
      this.props.gtcService.bus
        .getSubscriber()
        .on("ground_speed")
        .handle((v) => {
          this.groundSpeed.set(v);
        }),
    );
    if (isPrimary) {
      this.subscriptions.push(
        this.props.gtcService.bus
          .getSubscriber()
          .on("acars_state_request")
          .handle((e) => {
            this.props.gtcService.bus
              .getPublisher()
              .pub(
                "acars_state_response",
                { client: this.client.get() },
                true,
                false,
              );
          }),
      );
    } else {
      const sub = this.props.gtcService.bus
        .getSubscriber()
        .on("acars_state_response")
        .handle((e) => {
          if (e.client) {
            this.props.gtcService.bus.getPublisher().pub("acars_status_param", {
              label: "Flight ID",
              value: e.client.callsign,
            });
            this.props.gtcService.bus.getPublisher().pub("acars_new_client", {
              callsign: e.client.callsign,
            });
          }
          sub.destroy();
        });
      this.subscriptions.push(sub);
      this.props.gtcService.bus
        .getPublisher()
        .pub("acars_state_request", null, true, false);
    }
    if (isPrimary) {
      this.subscriptions.push(
        this.props.gtcService.bus
          .getSubscriber()
          .on("acars_message_ack")
          .handle((v) => {
            const state = this.client.get();
            const message = state.message_stack[v.id];
            if (message) {
              message.response(v.e);
              message.status.set("Closed");
            }
          }),
      );
      this.subscriptions.push(
        this.settingsManager.getSetting("network").sub((v) => {
          const oldClient = this.client.get();
          if (!oldClient) {
            return;
          }
          oldClient.dispose();
          const hoppieCode = this.settingsManager
            .getSetting("acars_code")
            .get();
          const isBeyondAtc = v === "beyondatc";

          const client = createClient(
            isBeyondAtc ? null : hoppieCode,
            oldClient.callsign,
            getAircraftIcao(),
            this.onMessage.bind(this),
            v,
          );
          this.client.set(client);
          this.canCreate.set(true);
        }),
      );
      this.subscriptions.push(
        this.props.gtcService.bus
          .getSubscriber()
          .on("acars_message_request")
          .handle((v) => {
            const state = this.client.get();
            state[v.key].apply(this, Object.values(v.arguments || {}));
          }),
      );
      this.subscriptions.push(
        this.props.gtcService.bus
          .getSubscriber()
          .on("acars_status_param")
          .handle((imp) => {
            if (imp.label !== "Flight ID") return;
            const v = imp.value;
            const oldClient = this.client.get();
            if (oldClient) {
              oldClient.dispose();
            }
            const hoppieCode = this.settingsManager
              .getSetting("acars_code")
              .get();
            const network = this.settingsManager.getSetting("network").get();
            const isBeyondAtc = network === "beyondatc";
            if (v && v.length && (hoppieCode || isBeyondAtc)) {
              const client = createClient(
                isBeyondAtc ? null : hoppieCode,
                v,
                getAircraftIcao(),
                this.onMessage.bind(this),
                network,
              );
              this.client.set(client);
              this.props.gtcService.bus.getPublisher().pub(
                "acars_new_client",
                {
                  callsign: client.callsign,
                },
                true,
                false,
              );
              this.canCreate.set(true);
            } else {
              this.canCreate.set(false);
              this.client.set(null);
              this.props.gtcService.bus
                .getPublisher()
                .pub("acars_new_client", null, true, false);
            }
          }),
      );
    } else {
      this.subscriptions.push(
        this.props.gtcService.bus
          .getSubscriber()
          .on("acars_new_client")
          .handle((v) => {
            if (!v) {
              this.client.set(null);
              this.canCreate.set(false);
              return;
            }
            const funcs = [
              "sendPdc",
              "sendOceanicClearance",
              "atisRequest",
              "sendTelex",
              "sendLevelChange",
              "sendSpeedChange",
              "sendDirectTo",
              "sendLogonRequest",
              "sendLogoffRequest",
            ];

            const client = {
              callsign: v.callsign,
              active_station: null,
              pending_station: null,
            };
            for (const key of funcs) {
              client[key] = () => {
                this.props.gtcService.bus.getPublisher().pub(
                  "acars_message_request",
                  {
                    key,
                    arguments,
                  },
                  true,
                  false,
                );
                return true;
              };
            }
            this.client.set(client);
            this.canCreate.set(true);
          }),
      );
    }

    this.options = [
      {
        title: "Pre Departure Clearance",
        freeText: true,
        freeTextCount: 5,
        onSend: async (d) => {
          const client = this.client.get();
          if (!client) return false;
          let t = this.depTime.get();
          if (t > 24 * 60) t /= 60;
          const dt = new Date();
          dt.setUTCHours(Math.floor(t / 60));
          dt.setUTCMinutes(Math.floor(t % 60));
          return client.sendPdc(
            d.Facility,
            d.Departure,
            d.Arrival,
            d.Stand,
            d.Atis,
            convertUnixToHHMM(dt.getTime()),
            d.FreeText,
          );
        },
        fields: [
          {
            name: "Facility",
            allowSpaces: false,
            maxLength: 4,
            type: GtcViewKeys.TextDialog,
            displayFallback: "----",
            validate: (v) => v.length,
          },
          {
            name: "Departure",
            allowSpaces: false,
            maxLength: 4,
            type: GtcViewKeys.TextDialog,
            displayFallback: "----",
            initialValue: () => {
              const fp = this.props.fms.getPrimaryFlightPlan();
              if (fp && fp.originAirportIcao) return fp.originAirportIcao.ident;
              return "";
            },
            validate: (v) => v.length,
          },
          {
            name: "A/C Type",
            allowSpaces: false,
            maxLength: 4,
            type: GtcViewKeys.TextDialog,
            initialValue: () => getAircraftIcao(),
            displayFallback: "----",
            validate: (v) => v.length,
          },
          {
            name: "Arrival",
            allowSpaces: false,
            maxLength: 4,
            initialValue: () => {
              const fp = this.props.fms.getPrimaryFlightPlan();
              if (fp && fp.destinationAirportIcao)
                return fp.destinationAirportIcao.ident;
              return "";
            },
            type: GtcViewKeys.TextDialog,
            displayFallback: "----",
            validate: (v) => v.length,
          },
          {
            name: "Atis",
            allowSpaces: false,
            maxLength: 1,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-",
            validate: (v) => v.length,
          },
          {
            name: "Stand",
            allowSpaces: true,
            maxLength: 10,
            type: GtcViewKeys.TextDialog,
            displayFallback: "----",
            validate: (v) => v.length,
          },
        ],
      },
      {
        title: "Oceanic Clearance Request",
        onSend: async (d) => {
          const client = this.client.get();
          if (!client) return false;
          return client.sendOceanicClearance(
            d["Callsign"],
            d["Facility"],
            d["Entry Waypoint"],
            d["ETA"],
            d["FL"],
            d["Mach"],
            d["FreeText"],
          );
        },
        freeText: true,
        freeTextCount: 5,
        fields: [
          {
            name: "Callsign",
            allowSpaces: false,
            maxLength: 7,
            type: GtcViewKeys.TextDialog,
            displayFallback: "----",
            validate: (v) => v.length > 0,
            initialValue: () => {
              return this.client.get().callsign;
            },
          },
          {
            name: "Facility",
            allowSpaces: false,
            maxLength: 20,
            type: GtcViewKeys.TextDialog,
            displayFallback: "------",
            validate: (v) => v.length > 0,
          },
          {
            name: "Entry Waypoint",
            allowSpaces: false,
            maxLength: 5,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-----",
            validate: (v) => v.length === 5,
          },
          {
            name: "ETA",
            allowSpaces: false,
            maxLength: 12,
            type: GtcViewKeys.DurationDialog1,
            displayFallback: "--:-- UTC",
            transform: (v) => `${v / 60}:${v % 60}`,
            validate: (v) => v.length,
          },
          {
            name: "FL",
            allowSpaces: false,
            maxLength: 3,
            type: GtcViewKeys.TextDialog,
            displayFallback: "FL___",
            validate: (v) => v.length && !Number.isNaN(Number.parseInt(v)),
          },
          {
            name: "Mach",
            allowSpaces: false,
            maxLength: 2,
            type: GtcViewKeys.TextDialog,
            displayFallback: ".--",
            validate: (v) => v.length && !Number.isNaN(Number.parseInt(v)),
          },
        ],
      },
      {
        title: "Position Report",
        onSend: async (d) => {
          const client = this.client.get();
          if (!client) return false;
          return client.sendPositionReport(
            d.FL,
            d.Mach,
            d["Waypoint"],
            d["Waypoint ATA"],
            d["Following Waypoint"],
            d["Following ETA"],
            d["Next Waypoint"],
          );
        },
        fields: [
          {
            name: "Mach",
            allowSpaces: false,
            maxLength: 4,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-----",
            validate: (v) => v.length && !Number.isNaN(Number.parseFloat(v)),
            initialValue: () =>
              `${SimVar.GetSimVarValue("AIRSPEED MACH", "mach").toFixed(1)}`,
          },
          {
            name: "FL",
            allowSpaces: false,
            maxLength: 5,
            type: GtcViewKeys.TextDialog,
            displayFallback: "---",
            transform: (v) => v.replace("FL", ""),
            validate: (v) => v.length && !Number.isNaN(Number.parseFloat(v)),
            inititalValue: () => {
              const v = SimVar.GetSimVarValue("INDICATED ALTITUDE", "feet");
              return (v / 100).toFixed(0);
            },
          },
          {
            name: "Waypoint",
            allowSpaces: false,
            maxLength: 10,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-----",
            validate: (v) => v.length,
            initialValue: () => {
              const fp = this.props.fms.getPrimaryFlightPlan();
              const leg = fp.getLeg(fp.activeLateralLeg);
              if (leg) return leg.name;
            },
          },
          {
            name: "Waypoint ATA",
            allowSpaces: false,
            maxLength: 10,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-----",
            validate: (v) => v.length,
            initialValue: () => {
              const time = new Date();
              const rem = 60 * (this.distance.get() / this.groundSpeed.get());
              time.setUTCHours(time.getUTCHours() + Math.floor(rem / 60));
              time.setUTCMinutes(time.getUTCMinutes() + Math.floor(rem % 60));
              return `${time.getUTCHours().toString().padStart(2, "0")}${time.getUTCMinutes().toString().padStart(2, "0")}`;
            },
          },
          {
            name: "Following Waypoint",
            allowSpaces: false,
            maxLength: 10,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-----",
            validate: (v) => v.length,
            initialValue: () => {
              const fp = this.props.fms.getPrimaryFlightPlan();
              const leg = fp.getLeg(fp.activeLateralLeg + 1);
              if (leg) return leg.name;
            },
          },
          {
            name: "Following ETA",
            allowSpaces: false,
            maxLength: 10,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-----",
            validate: (v) => v.length,
            initialValue: () => {
              const fp = this.props.fms.getPrimaryFlightPlan();
              const leg = fp.getLeg(fp.activeLateralLeg + 1);
              if (!leg) return null;
              const time = new Date();
              const rem =
                60 *
                ((this.distance.get() + leg.calculated.distance / 1852) /
                  this.groundSpeed.get());
              time.setUTCHours(time.getUTCHours() + Math.floor(rem / 60));
              time.setUTCMinutes(time.getUTCMinutes() + Math.floor(rem % 60));
              return `${time.getUTCHours().toString().padStart(2, "0")}${time.getUTCMinutes().toString().padStart(2, "0")}`;
            },
          },
          {
            name: "Next Waypoint",
            allowSpaces: false,
            maxLength: 10,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-----",
            validate: (v) => v.length,
            initialValue: () => {
              const fp = this.props.fms.getPrimaryFlightPlan();
              const leg = fp.getLeg(fp.activeLateralLeg + 2);
              if (leg) return leg.name;
            },
          },
        ],
      },
      {
        title: "Weather Request",
        onSend: async (d) => {
          const client = this.client.get();
          if (!client) return false;
          return client.atisRequest(d["Facility"], d["Type"]);
        },
        fields: [
          {
            name: "Facility",
            allowSpaces: false,
            maxLength: 4,
            type: GtcViewKeys.TextDialog,
            displayFallback: "----",
            validate: (v) => v.length === 4,
          },
          {
            name: "Type",
            options: [["METAR"], ["TAF"]],
            validate: (v) => true,
            initialValue: ["METAR"],
          },
        ],
      },
      {
        title: "Atis Request",
        onSend: async (d) => {
          const client = this.client.get();
          if (!client) return false;
          return client.atisRequest(d["Facility"], "ATIS", d["Type"]);
        },
        fields: [
          {
            name: "Facility",
            allowSpaces: false,
            maxLength: 4,
            type: GtcViewKeys.TextDialog,
            displayFallback: "----",
            validate: (v) => v.length === 4,
          },
          {
            name: "Type",
            options: [["D", "Departure"], ["A", "Arrival"]],
            validate: (v) => true,
            initialValue: ["D", "Departure"],
          },
        ],
      },
      {
        title: "Telex Message",
        onSend: async (d) => {
          const client = this.client.get();
          if (!client) return false;
          return client.sendTelex(d.Facility, d.FreeText);
        },
        freeText: true,
        freeTextCount: 20,
        fields: [
          {
            name: "Facility",
            allowSpaces: false,
            maxLength: 7,
            type: GtcViewKeys.TextDialog,
            displayFallback: "----",
            validate: (v) => v.length > 0,
          },
        ],
      },
      {
        title: "Request Level Change",
        onSend: async (d) => {
          const client = this.client.get();
          if (!client || !client.activestation) return false;

          const flValue = d.FL?.isFlightLevel
            ? `FL${String(Math.round(d.FL.altitudeFeet / 100)).padStart(3, "0")}`
            : `${Math.round(d.FL.altitudeFeet)}FT`;

          return client.sendLevelChange(
            flValue,
            d["Change"],
            d["Climb"],
            d["Reason"],
            d["FreeText"],
          );
        },
        freeText: false,
        freeTextCount: 0,
        fields: [
          {
            name: "Request Level",
            type: "ACARS_ENTRY_ALTITUDE",
            displayFallback: "FL___",
            renderValue: (v) => {
              if (!v) return "FL___";
              return v.isFlightLevel
                ? `FL${String(v.altitudeFeet / 100).padStart(3, "0")}`
                : `${v.altitudeFeet}FT`;
            },
            validate: (v) =>
              v !== null &&
              v !== "" &&
              !Number.isNaN(
                Number.parseInt(String(v.altitudeFeet / 100).padStart(3, "0")),
              ),
            initialValue: null,
          },
          {
            name: "Change",
            options: [["Climb"], ["Descend"]],
            validate: (v) => true,
            initialValue: ["Climb"],
          },
          {
            name: "Reason",
            options: [
              ["weather", "Due to Weather"],
              ["performance", "Due to Aircraft Performance"],
            ],
            validate: (v) => true,
            initialValue: ["performance", "Due to Aircraft Performance"],
          },
        ],
      },
      {
        title: "Request Speed Change",
        onSend: async (d) => {
          const client = this.client.get();
          if (!client || !client.active_station) return false;
          return client.sendSpeedChange(
            d["Knots/Mach"].toLowerCase(),
            d.Speed,
            d.Reason,
            d.FreeText,
          );
        },
        freeText: true,
        freeTextCount: 5,
        fields: [
          {
            name: "Speed",
            allowSpaces: false,
            maxLength: 5,
            type: GtcViewKeys.TextDialog,
            displayFallback: "---",
            validate: (v) => v.length && !Number.isNaN(Number.parseInt(v)),
          },
          {
            name: "Knots/Mach",
            options: [["Knots"], ["Mach"]],
            validate: (v) => true,
            initialValue: ["Mach"],
          },
          {
            name: "Reason",
            options: [
              ["weather", "Due to Weather"],
              ["performance", "Due to Aircraft Performance"],
            ],
            validate: (v) => true,
            initialValue: ["performance", "Due to Aircraft Performance"],
          },
        ],
      },
      {
        title: "Request Direct Waypoint",
        onSend: async (d) => {
          const client = this.client.get();
          if (!client || !client.active_station) return false;
          return client.sendDirectTo(d.Waypoint, d.Reason, d.FreeText);
        },
        freeText: true,
        freeTextCount: 5,
        fields: [
          {
            name: "Waypoint",
            allowSpaces: false,
            maxLength: 5,
            type: GtcViewKeys.TextDialog,
            displayFallback: "-----",
            validate: (v) => v.length >= 3,
          },

          {
            name: "Reason",
            options: [
              ["weather", "Due to Weather"],
              ["performance", "Due to Aircraft Performance"],
            ],
            validate: (v) => true,
            initialValue: ["performance", "Due to Aircraft Performance"],
          },
        ],
      },
    ];
  }
  onMessage(message) {
    this.bus.getPublisher().pub("acars_message", message, true);
    this.latestMessage.set(message);
    if (message.type === "send") return;

    // Count CPDLC messages as unread
    const count = this.unreadCount.get() + 1;
    this.unreadCount.set(count);
    this.cpdlcTabLabel.set(`CPDLC\n(${count})`);

    this.bus.getPublisher().pub(
      "cas_activate_alert",
      {
        key: { uuid: message.cpdlc ? "cpdlc-msg" : "acars-msg" },
        priority: AnnunciationType.Advisory,
      },
      true,
      false,
    );
    this.bus
      .getPublisher()
      .pub("aural_alert_trigger", "acars-msg-sound", true, false);
  }
  onGtcInteractionEvent(event) {
    switch (event) {
      case GtcInteractionEvent.ButtonBarEnterPressed: {
        const msg = this.latestMessage.get();
        if (msg) {
          this.props.gtcService
            .openPopup("ACARS_MESSAGE_PAGE", "normal", "hide")
            .ref.openMessage(message);
          return true;
        }
      }
      default:
        return false;
    }
    return false;
  }
  onAfterRender() {
    this._title.set("ATC Datalink");
    const manager = new CasRegistrationManager(this.props.gtcService.bus);
    manager.register({
      uuid: "acars-msg",
      message: "DATALINK MESSAGE",
    });
    manager.register({
      uuid: "cpdlc-msg",
      message: "ATC MESSAGE",
    });
    const audioManager = new AuralAlertRegistrationManager(
      this.props.gtcService.bus,
    );
    audioManager.register({
      uuid: "acars-msg-sound",
      queue: "acars-queue",
      priority: 0,
      sequence: "tone_caution",
      continuous: false,
      repeat: false,
    });

    setTimeout(() => {
      const mockMessage = {
        _id: 9999,
        from: "LFFF",
        type: "cpdlc",
        content: "CONTACT PARIS CONTROL ON 131.350",
        ts: Date.now(),
        viewed: false,
        respondSend: null,
        options: ["WILCO", "UNABLE", "STANDBY"],
        cpdlc: {
          protocol: "data2",
          min: "1",
          mrn: "",
          ra: "WU",
          content: "CONTACT PARIS CONTROL ON 131.350",
        },
        response: async (code) => {
          console.log("[MOCK] Response sent:", code);
        },
      };

      this.onMessage(mockMessage);
    }, 4000);
    setTimeout(() => {
      const mockMessage = {
        _id: 9999,
        from: "LFPG",
        type: "cpdlc",
        content: "PROCEED DIRECT TO ODILO",
        ts: Date.now(),
        viewed: false,
        respondSend: null,
        options: ["WILCO", "UNABLE", "STANDBY"],
        cpdlc: {
          protocol: "data2",
          min: "1",
          mrn: "",
          ra: "WU",
          content: "PROCEED DIRECT TO MTG",
        },
        response: async (code) => {
          console.log("[MOCK] Response sent:", code);
        },
      };

      this.onMessage(mockMessage);
    }, 1000);
    this.props.gtcService.registerView(
      GtcViewLifecyclePolicy.Transient,
      "ACARS_SETTINGS",
      "MFD",
      (gtcService, controlMode, displayPaneIndex) => {
        return (
          <AcarsSettingsPopUp
            settingsManager={this.settingsManager}
            gtcService={gtcService}
            displayPaneIndex={displayPaneIndex}
            controlMode={controlMode}
          />
        );
      },
      this.displayPaneIndex,
    );
    this.props.gtcService.registerView(
      GtcViewLifecyclePolicy.Transient,
      "ACARS_SEND",
      "MFD",
      (gtcService, controlMode, displayPaneIndex) => {
        return (
          <AcarsSendTemplate
            gtcService={gtcService}
            displayPaneIndex={displayPaneIndex}
            controlMode={controlMode}
            client={this.client}
          />
        );
      },
      this.displayPaneIndex,
    );
    this.props.gtcService.registerView(
      GtcViewLifecyclePolicy.Transient,
      "ADSC_CONTRACT",
      "MFD",
      (gtcService, controlMode, displayPaneIndex) => {
        return (
          <AdscContract
            gtcService={gtcService}
            displayPaneIndex={displayPaneIndex}
            controlMode={controlMode}
            client={this.client}
          />
        );
      },
      this.displayPaneIndex,
    );
    this.props.gtcService.registerView(
      GtcViewLifecyclePolicy.Transient,
      "ACARS_MESSAGE_OPT",
      "MFD",
      (gtcService, controlMode, displayPaneIndex) => {
        return (
          <AcarsMessageSendList
            gtcService={gtcService}
            displayPaneIndex={displayPaneIndex}
            controlMode={controlMode}
            items={this.options}
          />
        );
      },
      this.displayPaneIndex,
    );
    this.props.gtcService.registerView(
      GtcViewLifecyclePolicy.Transient,
      "ACARS_OPTIONS",
      "MFD",
      (gtcService, controlMode, displayPaneIndex) => {
        return (
          // <AcarsMessageSendList
          //   gtcService={gtcService}
          //   displayPaneIndex={displayPaneIndex}
          //   controlMode={controlMode}
          //   items={this.options}
          // />
          <></>
        );
      },
      this.displayPaneIndex,
    );
    this.props.gtcService.registerView(
      GtcViewLifecyclePolicy.Transient,
      "ACARS_MESSAGE_PAGE",
      "MFD",
      (gtcService, controlMode, displayPaneIndex) => {
        return (
          <AcarsMessagePage
            gtcService={gtcService}
            displayPaneIndex={displayPaneIndex}
            controlMode={controlMode}
            fms={this.props.fms}
          />
        );
      },
      this.displayPaneIndex,
    );
  }
  onResume() {
    this.tabsRef.instance.resume();
  }
  /** @inheritDoc */
  onPause() {
    this.tabsRef.instance.pause();
  }
  destroy() {
    // Destroy all subscriptions
    for (const sub of this.subscriptions) {
      if (sub && typeof sub.destroy === "function") {
        sub.destroy();
      }
    }
    this.subscriptions = [];

    // Dispose the ACARS client if primary
    if (this.isPrimary) {
      const client = this.client.get();
      if (client && typeof client.dispose === "function") {
        client.dispose();
      }
    }

    // Destroy tabs ref
    const tabs = this.tabsRef.getOrDefault();
    if (tabs && typeof tabs.destroy === "function") {
      tabs.destroy();
    }

    super.destroy();
  }
  render() {
    return (
      <div class={"acars-page"}>
        <TabbedContainer
          class={"acars-page-tab-container"}
          ref={this.tabsRef}
          configuration="L5"
        >
          {this.renderTab(1, "Status", this.renderStatusTab.bind(this))}
          {this.renderTab(
            2,
            this.cpdlcTabLabel,
            this.renderCpdlcTab.bind(this),
          )}
          {this.renderTab(3, this.adscTabLabel, this.renderAdscTab.bind(this))}
        </TabbedContainer>
        <GtcTouchButton
          class={"acars-page-display-button2"}
          label={"Create\nMessage"}
          isVisible={true}
          isEnabled={this.canCreate}
          onPressed={() => {
            this.props.gtcService.openPopup("ACARS_MESSAGE_OPT");
          }}
        />
        <GtcTouchButton
          class={"acars-page-display-button"}
          label={"Options"}
          isVisible={true}
          isEnabled={false}
          onPressed={() => {
            // this._activeComponent.map(v => console.log(v));
            // console.log(this._activeComponent.get(), this._sidebarState, this.context);
            // this.props.gtcService.openPopup("ACARS_OPTIONS");
          }}
        />
      </div>
    );
  }
  renderTab(position, label, renderContent) {
    const contentRef = FSComponent.createRef();
    const sidebarState = Subject.create(null);
    return (
      <TabbedContent
        position={position}
        label={label}
        onPause={() => {
          this._activeComponent.set(null);
          sidebarState.set(null);
          contentRef.instance.onPause();
        }}
        onResume={() => {
          this._activeComponent.set(contentRef.getOrDefault());
          sidebarState.set(this._sidebarState);
          contentRef.instance.onResume();
        }}
        disabled={contentRef === undefined}
      >
        {renderContent && renderContent(contentRef, sidebarState)}
      </TabbedContent>
    );
  }
  renderStatusTab(contentRef, sidebarState) {
    return (
      <StatusTab
        gtcService={this.props.gtcService}
        ref={contentRef}
        sidebarState={sidebarState}
        fms={this.props.fms}
        client={this.client}
        departureTime={this.depTime}
      />
    );
  }
  renderCpdlcTab(contentRef, sidebarState) {
    return (
      <CpdlcTab
        gtcService={this.props.gtcService}
        ref={contentRef}
        sidebarState={sidebarState}
        fms={this.props.fms}
      />
    );
  }
  renderAdscTab(contentRef, sidebarState) {
    return (
      <AdscTab
        gtcService={this.props.gtcService}
        ref={contentRef}
        sidebarState={sidebarState}
        fms={this.props.fms}
        client={this.client}
      />
    );
  }
}
/**
 * Entry parameters for the dialog.
 * @typedef {{
 *   initialAltitudeFeet: number,
 *   isFlightLevel: boolean,
 *   title?: string,
 *   maxAltitudeFeet?: number,
 *   isMaxAltitudeFlightLevel?: boolean,
 * }} VnavAltitudeDialogInput
 */

/**
 * Dialog result object.
 * @typedef {{
 *   wasCancelled: false,
 *   payload: { result: 'set', altitudeFeet: number, isFlightLevel: boolean }
 * } | { wasCancelled: true }} VnavAltitudeDialogResult
 */

const FORMATTER = (v, u) => v.toFixed(0);

// Based on VnavAltitudeDialog
export class GtcCpdlcAltitudeDialog extends GtcView {
  constructor(props) {
    super(props);

    this.mslInputRef = FSComponent.createRef();
    this.flInputRef = FSComponent.createRef();
    this.numpadRef = FSComponent.createRef();
    this.backspaceRef = FSComponent.createRef();

    /** @type {import('@microsoft/msfs-sdk').NodeReference<NumberInput> | null} */
    this.activeInput = null;

    this.mslInputCssClass = SetSubject.create([
      "number-dialog-input",
      "msl-input",
      "hidden",
    ]);
    this.flInputCssClass = SetSubject.create([
      "number-dialog-input",
      "fl-input",
      "hidden",
    ]);

    this.valueMSL = Subject.create(0);
    this.valueFL = Subject.create(0);

    this.flightLevelModeEnabled = Subject.create(false);
    this.meanSeaLevelModeEnabled = Subject.create(true);

    this.isFlightLevel = Subject.create(false);

    this.maxAltitudeFeet = undefined;
    this.isMaxAltitudeFlightLevel = undefined;

    this._resolve = null;
    this._resultObject = { wasCancelled: true };
  }

  onAfterRender(thisNode) {
    this._thisNode = thisNode;

    this._sidebarState.dualConcentricKnobLabel.set("dataEntryPushEnter");
    this._sidebarState.slot5.set("enterEnabled");

    this.mslInputRef.instance.isEditingActive.sub((isActive) => {
      this._onEditingActiveChanged(isActive);
    });
    this.flInputRef.instance.isEditingActive.sub((isActive) => {
      this._onEditingActiveChanged(isActive);
    });

    this.isFlightLevel.sub((isFlightLevel) => {
      this.flightLevelModeEnabled.set(isFlightLevel);
      this.meanSeaLevelModeEnabled.set(!isFlightLevel);

      this.activeInput?.instance.deactivateEditing();

      if (isFlightLevel) {
        this.activeInput = this.flInputRef;
        this.valueFL.set(this._convertFeetToFl(this.valueMSL.get()));
        this.flInputRef.instance.setValue(this.valueFL.get());
      } else {
        this.activeInput = this.mslInputRef;
        this.valueMSL.set(this._convertFlToFeet(this.valueFL.get()));
        this.mslInputRef.instance.setValue(this.valueMSL.get());
      }

      this.flInputCssClass.toggle("hidden", !isFlightLevel);
      this.mslInputCssClass.toggle("hidden", isFlightLevel);

      this.activeInput.instance.refresh();
    }, true);
  }

  onResume() {
    this.activeInput?.instance.refresh();
  }

  onClose() {
    this._cleanupRequest();
  }

  destroy() {
    this._cleanupRequest();
    this._thisNode && FSComponent.shallowDestroy(this._thisNode);
    super.destroy();
  }

  /**
   * @param {VnavAltitudeDialogInput} input
   * @returns {Promise<VnavAltitudeDialogResult>}
   */
  request(input) {
    return new Promise((resolve) => {
      this._cleanupRequest();

      this._resolve = resolve;
      this._resultObject = { wasCancelled: true };

      this._sidebarState.slot1.set(null);
      this._title.set(input.title ?? "Altitude Entry");

      this.maxAltitudeFeet = input.maxAltitudeFeet;
      this.isMaxAltitudeFlightLevel = input.isMaxAltitudeFlightLevel;

      this.isFlightLevel.set(input.isFlightLevel ?? false);

      this.valueMSL.set(input.initialAltitudeFeet);
      this.valueFL.set(this._convertFeetToFl(input.initialAltitudeFeet));

      this.mslInputRef.instance.setValue(this.valueMSL.get());
      this.flInputRef.instance.setValue(this.valueFL.get());
    });
  }

  onGtcInteractionEvent(event) {
    switch (event) {
      case GtcInteractionEvent.InnerKnobInc:
        this.activeInput?.instance.changeSlotValue(1);
        return true;
      case GtcInteractionEvent.InnerKnobDec:
        this.activeInput?.instance.changeSlotValue(-1);
        return true;
      case GtcInteractionEvent.OuterKnobInc:
        this.activeInput?.instance.moveCursor(1, true);
        return true;
      case GtcInteractionEvent.OuterKnobDec:
        this.activeInput?.instance.moveCursor(-1, true);
        return true;
      case GtcInteractionEvent.InnerKnobPush:
      case GtcInteractionEvent.InnerKnobPushLong:
      case GtcInteractionEvent.ButtonBarEnterPressed:
        this._validateAndClose();
        return true;
      default:
        return false;
    }
  }

  _convertFeetToFl(feet) {
    if (feet < 511) return feet;
    const converted = Math.round(feet / 100);
    return converted === 1000 ? 100 : converted;
  }

  _convertFlToFeet(fl) {
    return fl * 100;
  }

  _onEditingActiveChanged(isActive) {
    if (isActive) {
      this._sidebarState.slot1.set("cancel");
    }
  }

  _cleanupRequest() {
    this.activeInput?.instance.deactivateEditing();
    const resolve = this._resolve;
    this._resolve = null;
    resolve?.(this._resultObject);
  }

  _isValueValid(valueFeet) {
    if (this.maxAltitudeFeet !== undefined) {
      return valueFeet <= this.maxAltitudeFeet;
    }
    return true;
  }

  _getInvalidValueMessage() {
    if (this.isMaxAltitudeFlightLevel) {
      return (
        <div>
          <span>Invalid Altitude</span>
          <br />
          <span>Please enter an altitude less than</span>
          <br />
          <span>
            or equal to FL{((this.maxAltitudeFeet ?? 0) / 100).toFixed(0)}
          </span>
        </div>
      );
    }
    return (
      <div>
        <span>Invalid Altitude</span>
        <br />
        <span>Please enter an altitude less than</span>
        <br />
        <span>
          or equal to {this.maxAltitudeFeet?.toFixed(0)}
          <span class="numberunit-unit-small">FT</span>
        </span>
      </div>
    );
  }

  _onNumberPressed(value) {
    this.activeInput?.instance.setSlotCharacterValue(`${value}`);
  }

  _onBackspacePressed() {
    this.activeInput?.instance.backspace();
  }

  async _validateAndClose() {
    const isFL = this.isFlightLevel.get();
    const valueFeet = isFL
      ? this._convertFlToFeet(this.valueFL.get())
      : this.valueMSL.get();

    if (this._isValueValid(valueFeet)) {
      this._resultObject = {
        wasCancelled: false,
        payload: {
          result: "set",
          altitudeFeet: valueFeet,
          isFlightLevel: isFL,
        },
      };
      this.props.gtcService.goBack();
    } else {
      await this.props.gtcService
        .openPopup(GtcViewKeys.MessageDialog1)
        .ref.request({
          message: this._getInvalidValueMessage(),
          showRejectButton: false,
        });
    }
  }

  render() {
    return (
      <div class="number-dialog vnav-altitude-dialog">
        <NumberInput
          ref={this.mslInputRef}
          value={this.valueMSL}
          digitizeValue={(value, _setSign, setDigit) => {
            const v = MathUtils.clamp(Math.round(value), 0, 99999);
            setDigit[0](Math.trunc(v / 1e4), true);
            setDigit[1](Math.trunc((v % 1e4) / 1e3), true);
            setDigit[2](Math.trunc((v % 1e3) / 1e2), true);
            setDigit[3](Math.trunc((v % 1e2) / 1e1), true);
            setDigit[4](v % 1e1, true);
          }}
          renderInactiveValue={(value) => (
            <NumberUnitDisplay
              value={UnitType.FOOT.createNumber(
                MathUtils.clamp(Math.round(value), 0, 99999),
              )}
              displayUnit={null}
              formatter={FORMATTER}
              class="vnav-altitude-dialog-input-inactive"
            />
          )}
          allowBackFill={true}
          class={this.mslInputCssClass}
        >
          <DigitInputSlot
            characterCount={1}
            minValue={0}
            maxValue={10}
            increment={1}
            wrap={true}
            scale={1e4}
            defaultCharValues={[0]}
          />
          <DigitInputSlot
            characterCount={1}
            minValue={0}
            maxValue={10}
            increment={1}
            wrap={true}
            scale={1e3}
            defaultCharValues={[0]}
          />
          <DigitInputSlot
            characterCount={1}
            minValue={0}
            maxValue={10}
            increment={1}
            wrap={true}
            scale={1e2}
            defaultCharValues={[0]}
          />
          <DigitInputSlot
            characterCount={1}
            minValue={0}
            maxValue={10}
            increment={1}
            wrap={true}
            scale={1e1}
            defaultCharValues={[0]}
          />
          <DigitInputSlot
            characterCount={1}
            minValue={0}
            maxValue={10}
            increment={1}
            wrap={true}
            scale={1}
            defaultCharValues={[0]}
          />
          <div class="numberunit-unit-small">FT</div>
        </NumberInput>

        <NumberInput
          ref={this.flInputRef}
          value={this.valueFL}
          digitizeValue={(value, _setSign, setDigit) => {
            const v = MathUtils.clamp(Math.round(value), 0, 999);
            setDigit[0](Math.trunc(v / 1e2), true);
            setDigit[1](Math.trunc((v % 1e2) / 1e1), true);
            setDigit[2](v % 1e1, true);
          }}
          renderInactiveValue={(value) => (
            <div class="vnav-altitude-dialog-input-inactive">
              <span>FL</span>
              <span>
                {MathUtils.clamp(Math.round(value), 0, 999).toFixed(0)}
              </span>
            </div>
          )}
          allowBackFill={true}
          class={this.flInputCssClass}
        >
          <span>FL</span>
          <DigitInputSlot
            characterCount={1}
            minValue={0}
            maxValue={10}
            increment={1}
            wrap={true}
            scale={1e2}
            defaultCharValues={[0]}
          />
          <DigitInputSlot
            characterCount={1}
            minValue={0}
            maxValue={10}
            increment={1}
            wrap={true}
            scale={1e1}
            defaultCharValues={[0]}
          />
          <DigitInputSlot
            characterCount={1}
            minValue={0}
            maxValue={10}
            increment={1}
            wrap={true}
            scale={1}
            defaultCharValues={[0]}
          />
        </NumberInput>

        <div class="number-dialog-numpad-container vnav-altitude-dialog-numpad-container">
          <NumberPad
            ref={this.numpadRef}
            onNumberPressed={this._onNumberPressed.bind(this)}
            class="number-dialog-numpad vnav-altitude-dialog-numpad"
            orientation={this.props.gtcService.orientation}
          />
        </div>

        <ImgTouchButton
          ref={this.backspaceRef}
          label="BKSP"
          imgSrc={`${G3000FilePaths.ASSETS_PATH}/Images/GTC/icon_backspace_long.png`}
          onPressed={this._onBackspacePressed.bind(this)}
          class="number-dialog-backspace vnav-altitude-dialog-backspace"
        />

        <div class="gtc-panel mode-panel">
          <div class="gtc-panel-title">Mode</div>
          <GtcToggleTouchButton
            state={this.flightLevelModeEnabled}
            label={"Flight\nLevel"}
            onPressed={() => this.isFlightLevel.set(true)}
          />
          <GtcToggleTouchButton
            state={this.meanSeaLevelModeEnabled}
            label="MSL"
            onPressed={() => this.isFlightLevel.set(false)}
          />
        </div>
      </div>
    );
  }
}
// Singleton settings manager cache
let settingsManagerInstance = null;

export function getSettingsManager(bus) {
  if (!settingsManagerInstance) {
    settingsManagerInstance = new DefaultUserSettingManager(bus, [
      {
        defaultValue: GetStoredData("hoppie_code"),
        name: "acars_code",
      },
      {
        defaultValue: GetStoredData("g3ka_simbrief_id"),
        name: "g3ka_simbrief_id",
      },
      {
        defaultValue: GetStoredData("g3ka_network") || "hoppie",
        name: "network",
      },
    ]);
  }
  return settingsManagerInstance;
}

export { AcarsSettingsPopUp };
export default AcarsTabView;
