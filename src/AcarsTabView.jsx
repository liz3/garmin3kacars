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
} from "@microsoft/msfs-sdk";
import { DynamicList } from "@microsoft/msfs-garminsdk";
import {
  convertUnixToHHMM,
  createClient,
  messageStateUpdate,
} from "./Hoppie.mjs";
import getAircraftIcao from "./AircraftModels.mjs";

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
      this.props.gtcService.orientation === "horizontal" ? 110 : 60;
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
        type: GtcViewKeys.TextDialog,
      },
      {
        label: "Filed Dep Airport",
        source: this.departureAirport,
        renderValue: (v) => (v && v.length ? v : "----"),
        type: GtcViewKeys.TextDialog,
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
                .padStart(2, "0")}`
            : "__:__";
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
      props.gtcService.bus.getPublisher().pub(
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
              <GtcListItem key={e.label}>
                <GtcValueTouchButton
                  class={"acars-status-page-tab-left-list-item"}
                  state={e.source}
                  label={e.label}
                  renderValue={e.renderValue}
                  onPressed={async () => {
                    const result = await this.props.gtcService
                      .openPopup(e.type, "normal", "hide")
                      .ref.request({
                        label: e.label,
                        allowSpaces: false,
                        maxLength: 20,
                        initialValue: e.source.get(),
                        initialInputText: e.source.get(),
                      });
                    if (result.wasCancelled) {
                      return;
                    }
                    this.props.gtcService.bus
                      .getPublisher()
                      .pub(
                        "acars_status_param",
                        { label: e.label, value: result.payload },
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
      this.props.gtcService.orientation === "horizontal" ? 300 : 180;
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
        const message = this.messages
          .getArray()
          .find((msg) => e.id === msg._id);
        if (message) {
          message.state.set(e.state);
          message.viewed = true;
          if (e.state === "Closed") message.respondSend = e.option;
        }
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

    return (
      <GtcListItem>
        <GtcTouchButton
          onPressed={() => {
            this.props.gtcService
              .openPopup("ACARS_MESSAGE_PAGE", "normal", "hide")
              .ref.openMessage(message);
          }}
          isInList={true}
          class={"message-item"}
        >
          <div class={"text-block"}>
            <span>{content}</span>
          </div>
          <div class={"status-row"}>
            <span>{message.state}</span>
            <span>{message.from}</span>
            <span class={"strong"}>{convertUnixToHHMM(message.ts)}</span>
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
class AcarsMessagePage extends GtcView {
  constructor(props) {
    super(props);
    this.message = Subject.create(null);
    this.canReply = Subject.create(true);
    this.messageListRef = FSComponent.createRef();
    this.from = Subject.create("");
    this.content = Subject.create("");
    this.itemHeight = Subject.create(0);
    // i cant anymore. this framework is so terrible
    this.option1 = Subject.create(null);
    this.option2 = Subject.create(null);
    this.option3 = Subject.create(null);

    this.sizeInterval = setInterval(() => {
      const elem = document.getElementById("message-content-container");
      const height = elem.getBoundingClientRect().height + 30;
      if (this.itemHeight.get() !== height) this.itemHeight.set(height);
    }, 250);
  }

  openMessage(message) {
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
          key: { uuid: "acars-msg" },
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
            key: { uuid: "acars-msg" },
            priority: AnnunciationType.Advisory,
          },
          true,
          false,
        );
      }
    }

    message.viewed = true;
  }
  destroy() {
    const value = this.messageListRef.getOrDefault();
    if (value) value.destroy();
    if (this.sizeInterval) clearInterval(this.sizeInterval);
    super.destroy();
  }
  onAfterRender(thisNode) {
    this.thisNode = thisNode;
    this._title.set("CPDLC Thread");
  }
  renderOptionsItem(option) {
    return (
      <GtcTouchButton
        onPressed={async () => {
          const e = option.get();
          const message = this.message.get();
          if (message.respondSend) return;
          const result = await this.props.gtcService
            .openPopup(GtcViewKeys.MessageDialog1)
            .ref.request({
              message: `Respond With ${e}?`,
              showRejectButton: true,
              acceptButtonLabel: "Send",
              rejectButtonLabel: "Cancel",
            });
          if (!result.wasCancelled && result.payload === true) {
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
          }
        }}
        class={"btn"}
        isVisible={option}
        label={option}
        isEnabled={this.canReply}
      />
    );
  }
  render() {
    const sidebarState = Subject.create(null);
    return (
      <div class={"acars-message-page"}>
        <div class={"header"}>
          <span>{this.from}</span>
        </div>
        <GtcList
          class={"content-list"}
          ref={this.messageListRef}
          listItemSpacingPx={1}
          itemsPerPage={2}
          sidebarState={sidebarState}
          bus={this.bus}
          listItemHeightPx={this.itemHeight}
          heightPx={
            this.props.gtcService.orientation === "horizontal" ? 380 : 260
          }
        >
          <GtcListItem>
            <div class={"content"}>
              <span id="message-content-container">{this.content}</span>
            </div>
          </GtcListItem>
        </GtcList>
        <div class={"options"}>
          {this.renderOptionsItem(this.option1)}
          {this.renderOptionsItem(this.option2)}
          {this.renderOptionsItem(this.option3)}
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
            renderValue={(v) => (v ? v : e.displayFallback || "----")}
            onPressed={async () => {
              let result = await this.props.gtcService
                .openPopup(e.type, "normal", "hide")
                .ref.request({
                  label: e.name,
                  allowSpaces: e.allowSpaces || false,
                  maxLength: e.maxLength || 4,
                  initialValue: this[`field_${e.name}`].get(),
                  initialInputText: this[`field_${e.name}`].get(),
                });
              if (result.wasCancelled) {
                return;
              }

              this[`field_${e.name}`].set(
                e.transform ? e.transform(result.payload) : result.payload,
              );
              this.runValidCheck();
              let x = e;
              let inc = 0;
              while (
                x.name.includes(`Remarks`) &&
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
                if (result.wasCancelled) {
                  return;
                }
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
              this.props.settingsManager
                .getSetting("network")
                .set(v);
              SetStoredData("g3ka_network", v);
            }}
            listParams={{
              title: "Network",
              inputData: [
                { value: "hoppie", labelRenderer: (v) => "Hoppie" },
                {
                  value: "sayintentions",
                  labelRenderer: (v) => "Sayintentions",
                },
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
    const now = new Date();
    this.depTime = Subject.create(now.getUTCHours() * 60 + now.getUTCMinutes());
    this.props.gtcService.bus
      .getSubscriber()
      .on("lnavdata_waypoint_distance")
      .handle((v) => {
        this.distance.set(v);
      });
    this.props.gtcService.bus
      .getSubscriber()
      .on("ground_speed")
      .handle((v) => {
        this.groundSpeed.set(v);
      });
    if (isPrimary) {
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
        });
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
            props.gtcService.bus.getPublisher().pub("acars_new_client", {
              callsign: e.client.callsign,
            });
          }

          sub.destroy();
        });
      this.props.gtcService.bus
        .getPublisher()
        .pub("acars_state_request", null, true, false);
    }
    if (isPrimary) {
      props.gtcService.bus
        .getSubscriber()
        .on("acars_message_ack")
        .handle((v) => {
          const state = this.client.get();
          const message = state.message_stack[v.id];
          if (message) {
            message.response(v.e);
            message.status.set("Closed");
          }
        });
      this.settingsManager.getSetting("network").sub((v) => {
        const oldClient = this.client.get();
        if (!oldClient) {
          return;
        }
        oldClient.dispose();
        const hoppieCode = this.settingsManager.getSetting("acars_code").get();

        const client = createClient(
          hoppieCode,
          oldClient.callsign,
          getAircraftIcao(),
          this.onMessage.bind(this),
          this.settingsManager.getSetting("network").get(),
        );
        this.client.set(client);
        this.canCreate.set(true);
      });
      props.gtcService.bus
        .getSubscriber()
        .on("acars_message_request")
        .handle((v) => {
          const state = this.client.get();
          state[v.key].apply(this, Object.values(v.arguments || {}));
        });
      props.gtcService.bus
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
          if (v && v.length && hoppieCode) {
            const client = createClient(
              hoppieCode,
              v,
              getAircraftIcao(),
              this.onMessage.bind(this),
              this.settingsManager.getSetting("network").get(),
            );
            this.client.set(client);
            props.gtcService.bus.getPublisher().pub(
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
            props.gtcService.bus
              .getPublisher()
              .pub("acars_new_client", null, true, false);
          }
        });
    } else {
      props.gtcService.bus
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
            client[key] = function () {
              props.gtcService.bus.getPublisher().pub(
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
        });
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
            displayFallback: "--:--",
            transform: (v) => `${v / 60}:${v % 60}`,
            validate: (v) => v.length,
          },
          {
            name: "FL",
            allowSpaces: false,
            maxLength: 3,
            type: GtcViewKeys.TextDialog,
            displayFallback: "FL---",
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
            options: [["VATATIS", "ATIS"], ["METAR"], ["TAF"]],
            validate: (v) => true,
            initialValue: ["VATATIS", "ATIS"],
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
          if (!client || !client.active_station) return false;
          return client.sendLevelChange(
            d.FL,
            d.Change === "Climb",
            d.Reason,
            d.FreeText,
          );
        },
        freeText: true,
        freeTextCount: 5,
        fields: [
          {
            name: "FL",
            allowSpaces: false,
            maxLength: 3,
            type: GtcViewKeys.TextDialog,
            displayFallback: "FL---",
            validate: (v) => v.length && !Number.isNaN(Number.parseInt(v)),
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
    this.bus.getPublisher().pub(
      "cas_activate_alert",
      {
        key: { uuid: "acars-msg" },
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
      "ACARS_MESSAGE_PAGE",
      "MFD",
      (gtcService, controlMode, displayPaneIndex) => {
        return (
          <AcarsMessagePage
            gtcService={gtcService}
            displayPaneIndex={displayPaneIndex}
            controlMode={controlMode}
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
  destroy() {}
  render() {
    return (
      <div class={"acars-page"}>
        <TabbedContainer
          class={"acars-page-tab-container"}
          ref={this.tabsRef}
          configuration="L5"
        >
          {this.renderTab(1, "Status", this.renderStatusTab.bind(this))}
          {this.renderTab(2, "CPDLC", this.renderCpdlcTab.bind(this))}
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
          onPressed={() => {
            this.props.gtcService.openPopup("ACARS_SETTINGS");
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
}
export default AcarsTabView;
