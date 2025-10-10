
       function require(m) {
         const MODS = {
          "@microsoft/msfs-sdk": window.msfssdk,
          "@microsoft/msfs-garminsdk": window.garminsdk,
          "@microsoft/msfs-wtg3000-common": window.wtg3000common,
          "@microsoft/msfs-wtg3000-gtc": window.wtg3000gtc,
         }
        if(MODS[m])
          return MODS[m];
         throw new Error(`Unknown module ${m}`);
       }
    
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/app.mjs
  var import_msfs_sdk4 = __toESM(__require("@microsoft/msfs-sdk"), 1);
  var import_msfs_wtg3000_gtc3 = __require("@microsoft/msfs-wtg3000-gtc");

  // src/Interceptor.jsx
  var import_msfs_garminsdk3 = __require("@microsoft/msfs-garminsdk");
  var import_msfs_sdk3 = __require("@microsoft/msfs-sdk");

  // src/AcarsTabView.jsx
  var import_msfs_wtg3000_gtc = __require("@microsoft/msfs-wtg3000-gtc");
  var import_msfs_sdk = __require("@microsoft/msfs-sdk");
  var import_msfs_garminsdk = __require("@microsoft/msfs-garminsdk");

  // src/Hoppie.mjs
  var parseMessages = (input) => {
    const messagePattern = /\{(\w+)\s+(\w+)\s+\{([^}]+)\}\}/g;
    let match;
    const messages = [];
    while ((match = messagePattern.exec(input)) !== null) {
      const message2 = {
        ts: Date.now(),
        from: match[1],
        type: match[2],
        payload: match[3]
      };
      if (message2.type === "cpdlc" || message2.type === "telex") {
        const parts = message2.payload.split("/");
        if (message2.type === "cpdlc") {
          message2.cpdlc = {
            protocol: parts[1],
            min: parts[2],
            mrn: parts[3],
            ra: parts[4],
            content: parts[5]
          };
          message2.content = message2.cpdlc.content;
          if (message2.content) {
            message2.content = message2.content.replace(/@/g, "");
          }
        } else {
          const nonEmptyParts = parts.filter((part) => part !== "");
          message2.content = nonEmptyParts.pop();
        }
      } else {
        message2.content = message2.payload;
      }
      messages.push(message2);
    }
    return messages;
  };
  var sendAcarsMessage = async (state, receiver, payload, messageType) => {
    const params = new URLSearchParams([
      ["logon", state.code],
      ["from", state.callsign],
      ["type", messageType],
      ["to", receiver],
      ["packet", payload]
    ]);
    return fetch(`${state._service_url}?${params.toString()}`, {
      method: "GET"
    });
  };
  var responseOptions = (c) => {
    const map = {
      WU: ["WILCO", "UNABLE"],
      AN: ["AFFIRMATIVE", "NEGATIVE"],
      R: ["ROGER", "UNABLE"],
      RA: ["ROGER", "UNABLE"],
      Y: ["YES", "NO"],
      N: ["YES", "NO"]
    };
    if (map[c]) return [...map[c], "STANDBY"];
    return null;
  };
  var forwardStateUpdate = (state) => {
    if (state._stationCallback)
      state._stationCallback({
        active: state.active_station,
        pending: state.pending_station
      });
  };
  var messageStateUpdate = (state, message2) => {
    if (message2.type === "cpdlc" && message2.content === "LOGON ACCEPTED" && state.pending_station) {
      state.active_station = message2.from;
      state.pending_station = null;
      forwardStateUpdate(state);
    } else if (message2.type === "cpdlc" && message2.content === "LOGOFF" && state.active_station) {
      state.active_station = null;
      state.pending_station = null;
      forwardStateUpdate(state);
    }
  };
  var cpdlcStringBuilder = (state, request, replyId = "") => {
    if (state._min_count === 63) {
      state._min_count = 0;
    }
    state._min_count++;
    return `/data2/${state._min_count}/${replyId}/N/${request}`;
  };
  var poll = (state) => {
    state._interval = setTimeout(() => {
      sendAcarsMessage(state, "SERVER", "Nothing", "POLL").then((response) => {
        if (response.ok) {
          response.text().then((raw) => {
            for (const message2 of parseMessages(raw)) {
              if (message2.from === state.callsign && message2.type === "inforeq") {
                continue;
              }
              if (state.active_station && message2.from === state.active_station && message2.content.startsWith("HANDOVER")) {
                state.active_station = null;
                const station = message2.content.split(" ")[1];
                if (station) {
                  const corrected = station.trim().replace("@", "");
                  state.sendLogonRequest(corrected);
                  continue;
                }
              }
              message2._id = state.idc++;
              messageStateUpdate(state, message2);
              if (message2.type === "cpdlc" && message2.cpdlc.ra) {
                const opts = responseOptions(message2.cpdlc.ra);
                if (opts)
                  message2.response = async (code) => {
                    message2.respondSend = code;
                    if (state._min_count === 63) {
                      state._min_count = 0;
                    }
                    state._min_count++;
                    sendAcarsMessage(
                      state,
                      message2.from,
                      `/data2/${state._min_count}/${message2.cpdlc.min}/${code === "STANDBY" ? "NE" : "N"}/${code}`,
                      "cpdlc"
                    );
                  };
                message2.options = opts;
                message2.respondSend = null;
              }
              state.message_stack[message2._id] = message2;
              state._callback(message2);
            }
            poll(state);
          }).catch((err) => {
            poll(state);
          });
        } else {
          poll(state);
        }
      }).catch((err) => {
        poll(state);
      });
    }, 1e4);
  };
  var addMessage = (state, content) => {
    state._callback({
      type: "send",
      content,
      from: state.callsign,
      ts: Date.now()
    });
    return content;
  };
  var convertUnixToHHMM = (unixTimestamp) => {
    const date = new Date(unixTimestamp);
    let hours = date.getUTCHours();
    let minutes = date.getUTCMinutes();
    hours = hours.toString().padStart(2, "0");
    minutes = minutes.toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };
  var SERVICES = {
    hoppie: "https://www.hoppie.nl/acars/system/connect.html",
    sayintentions: " https://acars.sayintentions.ai/acars/system/connect.html"
  };
  var createClient = (code, callsign, aicraftType, messageCallback, service = "hoppie") => {
    const state = {
      code,
      callsign,
      _callback: messageCallback,
      active_station: null,
      pending_station: null,
      _min_count: 0,
      aircraft: aicraftType,
      idc: 0,
      message_stack: {},
      _service_url: SERVICES[service]
    };
    state.dispose = () => {
      if (state._interval) clearInterval(state._interval);
      state._interval = null;
    };
    state.sendTelex = async (to, message2) => {
      const response = await sendAcarsMessage(
        state,
        to,
        addMessage(state, message2.toUpperCase()),
        "telex"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.atisRequest = async (icao, type) => {
      const response = await sendAcarsMessage(
        state,
        state.callsign,
        `${(type === "ATIS" ? "VATATIS" : type).toUpperCase()} ${icao}`,
        "inforeq"
      );
      if (!response.ok) return false;
      const text = await response.text();
      for (const message2 of parseMessages(text)) {
        state._callback(message2);
      }
      return text.startsWith("ok");
    };
    state.sendPositionReport = async (fl, mach, wp, wpEta, nextWp, nextWpEta, followWp) => {
      if (!state.active_station) return;
      const content = `OVER ${wp} AT ${wpEta}Z FL${fl}, ESTIMATING ${nextWp} AT ${nextWpEta}Z, THEREAFTER ${followWp}. CURRENT SPEED M${mach}`.toUpperCase();
      const response = await sendAcarsMessage(
        state,
        state.active_station,
        `/DATA1/*/*/*/*/FL${fl}/*/${mach}/

${content}`,
        "position"
      );
      addMessage(state, content);
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendLogonRequest = async (to) => {
      if (to === state.active_station) return;
      state.pending_station = to;
      const response = await sendAcarsMessage(
        state,
        to,
        cpdlcStringBuilder(state, addMessage(state, `REQUEST LOGON`)),
        "cpdlc"
      );
      if (!response.ok) return false;
      forwardStateUpdate(state);
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendLogoffRequest = async () => {
      if (!state.active_station) return;
      const station = state.active_station;
      state.active_station = null;
      const response = await sendAcarsMessage(
        state,
        station,
        cpdlcStringBuilder(state, addMessage(state, `LOGOFF`)),
        "cpdlc"
      );
      if (!response.ok) return false;
      const text = await response.text();
      forwardStateUpdate(state);
      return text.startsWith("ok");
    };
    state.sendOceanicClearance = async (cs, to, entryPoint, eta, level, mach, freeText) => {
      const response = await sendAcarsMessage(
        state,
        to,
        addMessage(
          state,
          `REQUEST OCEANIC CLEARANCE ${cs} ${state.aircraft} ESTIMATING ${entryPoint} AT ${eta}Z FLIGHT LEVEL ${level} REQUEST MACH ${mach}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
        ),
        "telex"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendPdc = async (to, dep, arr, stand, atis, eob, freeText) => {
      const response = await sendAcarsMessage(
        state,
        to,
        addMessage(
          state,
          `REQUEST PREDEP CLEARANCE ${state.callsign} ${state.aircraft} TO ${arr} AT ${dep} ${stand} ATIS ${atis} ${eob}Z${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
        ),
        "telex"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendLevelChange = async (lvl, climb, reason, freeText) => {
      const response = await sendAcarsMessage(
        state,
        state.active_station,
        cpdlcStringBuilder(
          state,
          addMessage(
            state,
            `REQUEST ${climb ? "CLIMB" : "DESCEND"} TO FL${lvl} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
          )
        ),
        "cpdlc"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendSpeedChange = async (unit, value, reason, freeText) => {
      const response = await sendAcarsMessage(
        state,
        state.active_station,
        cpdlcStringBuilder(
          state,
          addMessage(
            state,
            `REQUEST ${unit === "knots" ? `${value} kts` : `M${value}`} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
          )
        ),
        "cpdlc"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    state.sendDirectTo = async (waypoint, reason, freeText) => {
      const response = await sendAcarsMessage(
        state,
        state.active_station,
        cpdlcStringBuilder(
          state,
          addMessage(
            state,
            `REQUEST DIRECT TO ${waypoint} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase()
          )
        ),
        "cpdlc"
      );
      if (!response.ok) return false;
      const text = await response.text();
      return text.startsWith("ok");
    };
    poll(state);
    return state;
  };

  // src/AircraftModels.mjs
  var models = {
    "Asobo Cessna Citation Longitude": "C700",
    "Cessna Longitude Asobo": "C700",
    "Microsoft Vision Jet": "SF50",
    "Asobo TBM 930": "TMB9",
    "Citation CJ3+": "C25B"
  };
  var weights = {
    "Asobo Cessna Citation Longitude": {
      pax: [3, 5, 4, 6, 7, 9, 8, 10],
      cargo: [11, 12]
    },
    "Cessna Longitude Asobo": {
      pax: [3, 5, 4, 6, 7, 9, 8, 10],
      cargo: [11, 12]
    },
    "Asobo TBM 930": {
      pax: [2, 3, 4, 5, 6],
      cargo: [7, 8]
    },
    "Citation CJ3+": {
      pax: [1, 2, 3, 4, 5, 6, 7, 8.9],
      cargo: [10, 11]
    }
  };
  var getAircraftIcao = () => {
    const v = SimVar.GetSimVarValue("TITLE", "string");
    for (const k in models) {
      if (v.includes(k)) return models[k];
    }
    return "";
  };
  var getAircraftPayloadStations = () => {
    const v = SimVar.GetSimVarValue("TITLE", "string");
    for (const k in weights) {
      if (v.includes(k)) return weights[k];
    }
    return null;
  };
  var AircraftModels_default = getAircraftIcao;

  // src/AcarsTabView.jsx
  var StatusLine = class extends import_msfs_sdk.DisplayComponent {
    constructor() {
      super(...arguments);
      this.classes = import_msfs_sdk.Subject.create(
        this.props.dotted.get() ? "acars-status-line line-dotted" : "acars-status-line"
      );
      this.props.dotted.sub((e) => {
        this.classes.set(
          e ? "acars-status-line line-dotted" : "acars-status-line"
        );
      });
    }
    render() {
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        "div",
        {
          style: {
            display: this.props.isVisible.map((e) => e ? "block" : "none"),
            left: this.props.left,
            top: this.props.top
          },
          class: this.classes
        },
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          "div",
          {
            style: { background: this.props.backgroundColor.map((e) => e) },
            class: "acars-l-g"
          }
        ),
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          "div",
          {
            style: { background: this.props.backgroundColor.map((e) => e) },
            class: "acars-l-s"
          }
        ),
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          "div",
          {
            style: { background: this.props.backgroundColor.map((e) => e) },
            class: "acars-l-g"
          }
        ),
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          "div",
          {
            style: { background: this.props.backgroundColor.map((e) => e) },
            class: "acars-l-s"
          }
        ),
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          "div",
          {
            style: { background: this.props.backgroundColor.map((e) => e) },
            class: "acars-l-g"
          }
        ),
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          "div",
          {
            style: { background: this.props.backgroundColor.map((e) => e) },
            class: "acars-l-s"
          }
        )
      );
    }
  };
  var StatusTab = class extends import_msfs_sdk.DisplayComponent {
    constructor() {
      super(...arguments);
      this.firstLineLeft = this.props.gtcService.orientation === "horizontal" ? "67px" : "36px";
      this.secondLineLeft = this.props.gtcService.orientation === "horizontal" ? "179px" : "89px";
      this.firstLineTop = this.props.gtcService.orientation === "horizontal" ? "9px" : "18px";
      this.secondLineTop = this.props.gtcService.orientation === "horizontal" ? "9px" : "18px";
      this.listRef = import_msfs_sdk.FSComponent.createRef();
      this.listItemHeight = this.props.gtcService.orientation === "horizontal" ? 110 : 60;
      this.facility = import_msfs_sdk.Subject.create("");
      this.flightId = import_msfs_sdk.Subject.create("");
      this.destinationAirport = import_msfs_sdk.Subject.create(
        (() => {
          const fp = this.props.fms.getPrimaryFlightPlan();
          if (fp && fp.destinationAirportIcao)
            return fp.destinationAirportIcao.ident;
          return "";
        })()
      );
      this.departureAirport = import_msfs_sdk.Subject.create(
        (() => {
          const fp = this.props.fms.getPrimaryFlightPlan();
          if (fp && fp.originAirportIcao) return fp.originAirportIcao.ident;
          return "";
        })()
      );
      this.conBtnState = import_msfs_sdk.Subject.create("Logon");
      this.conBtnEnabled = import_msfs_sdk.Subject.create(false);
      this.acarsConnected = import_msfs_sdk.Subject.create(false);
      this.station = import_msfs_sdk.Subject.create("----");
      this.nextStation = import_msfs_sdk.Subject.create("----");
      this.secondLineEnabled = import_msfs_sdk.Subject.create(false);
      this.secondLineDotted = import_msfs_sdk.Subject.create(false);
      this.secondLineYellow = import_msfs_sdk.Subject.create(false);
      this.props.gtcService.bus.getSubscriber().on("acars_message").handle((message2) => {
        const client = this.props.client.get();
        if (!client) return;
        if (this.props.gtcService.gtcThisSide === "right")
          messageStateUpdate(client, message2);
        this.conBtnState.set(client.active_station ? "Logoff" : "Logon");
        this.station.set(client.active_station || "----");
        this.nextStation.set(client.pending_station || "----");
        this.secondLineEnabled.set(
          client.active_station || client.pending_station
        );
        this.secondLineDotted.set(
          client.pending_station && !client.active_station
        );
        this.secondLineYellow.set(
          client.pending_station && !client.active_station
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
          renderValue: (v) => v && v.length ? v : "----",
          type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog
        },
        {
          label: "Flight ID",
          source: this.flightId,
          renderValue: (v) => v && v.length ? v : "----",
          type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog
        },
        {
          label: "Destination Airport",
          source: this.destinationAirport,
          renderValue: (v) => v && v.length ? v : "----",
          type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog
        },
        {
          label: "Filed Dep Airport",
          source: this.departureAirport,
          renderValue: (v) => v && v.length ? v : "----",
          type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog
        },
        {
          label: "Filed Dep Time",
          source: this.props.departureTime,
          renderValue: (r) => {
            const v = r > 60 * 24 ? r / 60 : r;
            return v ? `${Math.floor(v / 60).toString().padStart(2, "0")}:${Math.floor(v % 60).toString().padStart(2, "0")}` : "__:__";
          },
          type: import_msfs_wtg3000_gtc.GtcViewKeys.DurationDialog1
        }
      ];
      this.props.gtcService.bus.getSubscriber().on("acars_status_param").handle((e) => {
        this.itemList.find((x) => x.label === e.label).source.set(e.value);
      });
    }
    onResume() {
    }
    /** @inheritDoc */
    onPause() {
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
            key: !client.active_station ? "sendLogonRequest" : "sendLogoffRequest",
            arguments: [this.facility.get()]
          },
          true,
          false
        );
      }
    }
    render() {
      const sidebarState = import_msfs_sdk.Subject.create(null);
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-page-status-tab" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-status-page-tab-left" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "title-col" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", null, "Logon Setup")), /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcList,
        {
          ref: this.listRef,
          listItemSpacingPx: 1,
          sidebarState,
          bus: this.bus,
          itemsPerPage: 5,
          listItemHeightPx: this.listItemHeight
        },
        this.itemList.map((e) => /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_wtg3000_gtc.GtcListItem, { key: e.label }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          import_msfs_wtg3000_gtc.GtcValueTouchButton,
          {
            class: "acars-status-page-tab-left-list-item",
            state: e.source,
            label: e.label,
            renderValue: e.renderValue,
            onPressed: async () => {
              const result = await this.props.gtcService.openPopup(e.type, "normal", "hide").ref.request({
                label: e.label,
                allowSpaces: false,
                maxLength: 20,
                initialValue: e.source.get(),
                initialInputText: e.source.get()
              });
              if (result.wasCancelled) {
                return;
              }
              this.props.gtcService.bus.getPublisher().pub(
                "acars_status_param",
                { label: e.label, value: result.payload },
                true,
                false
              );
            },
            isInList: true
          }
        )))
      )), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-status-page-tab-right" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", null, "Connection: ", this.acarsConnected.map((e) => e ? "ATN" : "----")), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "icons-list acars-pane-padding" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        StatusLine,
        {
          dotted: import_msfs_sdk.Subject.create(false),
          isVisible: this.acarsConnected,
          backgroundColor: import_msfs_sdk.Subject.create("green"),
          left: this.firstLineLeft,
          top: this.firstLineTop
        }
      ), /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        StatusLine,
        {
          dotted: this.secondLineDotted,
          isVisible: this.secondLineEnabled,
          backgroundColor: this.secondLineYellow.map(
            (e) => e ? "yellow" : "green"
          ),
          left: this.secondLineLeft,
          top: this.secondLineTop
        }
      ), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("img", { src: "coui://html_ui/garmin-3000-acars/assets/plane.png" }), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("img", { src: "coui://html_ui/garmin-3000-acars/assets/anntena.png" }), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("img", { src: "coui://html_ui/garmin-3000-acars/assets/tower.png" })), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", { class: "acars-pane-padding" }, "ATN Link Available"), /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcTouchButton,
        {
          onPressed: this.stateBtnPressed.bind(this),
          label: this.conBtnState,
          isEnabled: this.conBtnEnabled,
          class: "state-btn acars-pane-padding"
        }
      ), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-pane-padding acars-pane-center border-btm" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", { class: "normal" }, "Current Facility"), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", { class: "big" }, this.station), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("br", null)), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-pane-padding acars-pane-center" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", { class: "normal" }, "Next Facility"), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", { class: "big" }, this.nextStation), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("br", null))));
    }
  };
  var CpdlcTab = class extends import_msfs_sdk.DisplayComponent {
    constructor() {
      super(...arguments);
      this.listRef = import_msfs_sdk.FSComponent.createRef();
      this.messages = import_msfs_sdk.ArraySubject.create();
      this.listItemHeight = this.props.gtcService.orientation === "horizontal" ? 300 : 180;
      if (window.acarsSide === "primary") {
        this.props.gtcService.bus.getSubscriber().on("acars_message_state_request").handle((e) => {
          this.props.gtcService.bus.getPublisher().pub(
            "acars_state_message_response",
            { messages: this.messages.getArray() },
            true,
            false
          );
        });
      } else {
        const sub = this.props.gtcService.bus.getSubscriber().on("acars_state_message_response").handle((e) => {
          for (const entry of e.messages) this.messages.insert(entry);
          sub.destroy();
        });
        this.props.gtcService.bus.getPublisher().pub("acars_message_state_request", null, true, false);
      }
      this.props.gtcService.bus.getSubscriber().on("acars_message").handle((e) => {
        e.state = import_msfs_sdk.Subject.create(
          e.type === "send" ? "Send" : e.options && !e.respondSend ? "Need Response" : "Incoming"
        );
        if (e.from === "acars") e.from = "";
        e.viewed = e.type === "send";
        this.messages.insert(e, 0);
      });
      this.props.gtcService.bus.getSubscriber().on("acars_message_read_state").handle((e) => {
        const message2 = this.messages.getArray().find((msg) => e.id === msg._id);
        if (message2) {
          message2.state.set(e.state);
          message2.viewed = true;
          if (e.state === "Closed") message2.respondSend = e.option;
        }
      });
    }
    onResume() {
    }
    /** @inheritDoc */
    onPause() {
    }
    onAfterRender(thisNode) {
      this.thisNode = thisNode;
    }
    onGtcInteractionEvent() {
      return false;
    }
    stateBtnPressed() {
    }
    renderItem(message2) {
      const content = message2.content.length < 21 ? message2.content : `${message2.content.substr(0, 21)}...`;
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_wtg3000_gtc.GtcListItem, null, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcTouchButton,
        {
          onPressed: () => {
            this.props.gtcService.openPopup("ACARS_MESSAGE_PAGE", "normal", "hide").ref.openMessage(message2);
          },
          isInList: true,
          class: "message-item"
        },
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "text-block" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", null, content)),
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "status-row" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", null, message2.state), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", null, message2.from), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", { class: "strong" }, convertUnixToHHMM(message2.ts)))
      ));
    }
    render() {
      const sidebarState = import_msfs_sdk.Subject.create(null);
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-page-cpdlc-tab" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcList,
        {
          ref: this.listRef,
          listItemSpacingPx: 1,
          sidebarState,
          bus: this.bus,
          data: this.messages,
          renderItem: this.renderItem.bind(this),
          listItemHeightPx: this.listItemHeight
        }
      ));
    }
  };
  var AcarsMessagePage = class extends import_msfs_wtg3000_gtc.GtcView {
    constructor(props2) {
      super(props2);
      this.message = import_msfs_sdk.Subject.create(null);
      this.canReply = import_msfs_sdk.Subject.create(true);
      this.messageListRef = import_msfs_sdk.FSComponent.createRef();
      this.from = import_msfs_sdk.Subject.create("");
      this.content = import_msfs_sdk.Subject.create("");
      this.itemHeight = import_msfs_sdk.Subject.create(0);
      this.option1 = import_msfs_sdk.Subject.create(null);
      this.option2 = import_msfs_sdk.Subject.create(null);
      this.option3 = import_msfs_sdk.Subject.create(null);
      this.sizeInterval = setInterval(() => {
        const elem = document.getElementById("message-content-container");
        const height = elem.getBoundingClientRect().height + 30;
        if (this.itemHeight.get() !== height) this.itemHeight.set(height);
      }, 250);
    }
    openMessage(message2) {
      this.message.set(message2);
      this.from.set(message2.from);
      this.content.set(message2.content);
      this.canReply.set(message2.options && !message2.respondSend);
      if (message2.options && !message2.respondSend) {
        const arr = [this.option1, this.option2, this.option3];
        message2.options.forEach((v, i) => arr[i].set(v));
        this.bus.getPublisher().pub(
          "cas_deactivate_alert",
          {
            key: { uuid: "acars-msg" },
            priority: import_msfs_sdk.AnnunciationType.Advisory
          },
          true,
          false
        );
      } else {
        if (!message2.viewed && message2.type !== "send") {
          this.bus.getPublisher().pub(
            "acars_message_read_state",
            {
              id: message2._id,
              state: "Viewed"
            },
            true,
            false
          );
          this.bus.getPublisher().pub(
            "cas_deactivate_alert",
            {
              key: { uuid: "acars-msg" },
              priority: import_msfs_sdk.AnnunciationType.Advisory
            },
            true,
            false
          );
        }
      }
      message2.viewed = true;
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
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcTouchButton,
        {
          onPressed: async () => {
            const e = option.get();
            const message2 = this.message.get();
            if (message2.respondSend) return;
            const result = await this.props.gtcService.openPopup(import_msfs_wtg3000_gtc.GtcViewKeys.MessageDialog1).ref.request({
              message: `Respond With ${e}?`,
              showRejectButton: true,
              acceptButtonLabel: "Send",
              rejectButtonLabel: "Cancel"
            });
            if (!result.wasCancelled && result.payload === true) {
              if (window.acarsSide === "primary") message2.response(e);
              else
                this.props.gtcService.bus.getPublisher().pub(
                  "acars_message_ack",
                  {
                    e,
                    id: message2._id
                  },
                  true,
                  false
                );
              this.bus.getPublisher().pub(
                "acars_message_read_state",
                {
                  id: message2._id,
                  state: "Closed",
                  option: e
                },
                true,
                false
              );
              this.message.set(message2);
              this.canReply.set(false);
              const arr = [this.option1, this.option2, this.option3];
              message2.options.forEach((v, i) => arr[i].set(v === e ? e : null));
            }
          },
          class: "btn",
          isVisible: option,
          label: option,
          isEnabled: this.canReply
        }
      );
    }
    render() {
      const sidebarState = import_msfs_sdk.Subject.create(null);
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-message-page" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "header" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", null, this.from)), /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcList,
        {
          class: "content-list",
          ref: this.messageListRef,
          listItemSpacingPx: 1,
          itemsPerPage: 2,
          sidebarState,
          bus: this.bus,
          listItemHeightPx: this.itemHeight,
          heightPx: this.props.gtcService.orientation === "horizontal" ? 380 : 260
        },
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_wtg3000_gtc.GtcListItem, null, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "content" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", { id: "message-content-container" }, this.content)))
      ), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "options" }, this.renderOptionsItem(this.option1), this.renderOptionsItem(this.option2), this.renderOptionsItem(this.option3)));
    }
  };
  var AcarsSendTemplate = class extends import_msfs_wtg3000_gtc.GtcView {
    constructor(props2) {
      super(props2);
      this.listRef = import_msfs_sdk.FSComponent.createRef();
      this.itemListRef = import_msfs_sdk.FSComponent.createRef();
      this.buttonText = import_msfs_sdk.Subject.create("Send");
      this.itemTitle = import_msfs_sdk.Subject.create("-");
      this.listItemHeight = this.props.gtcService.orientation === "horizontal" ? 130 : 70;
      this.dataMaps = import_msfs_sdk.ObjectSubject.create({});
      this.fields = import_msfs_sdk.ArraySubject.create();
      this.option = import_msfs_sdk.Subject.create({});
      this.valid = import_msfs_sdk.Subject.create(false);
    }
    destroy() {
      let value = this.listRef.getOrDefault();
      if (value) value.destroy();
      value = this.itemListRef.getOrDefault();
      if (value) value.destroy();
      this.clearOld();
      super.destroy();
    }
    onPause() {
    }
    onAfterRender() {
      this._title.set("Select Message");
    }
    renderItem(e, i) {
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_wtg3000_gtc.GtcListItem, null, e.options ? /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcListSelectTouchButton,
        {
          isInList: true,
          class: "item",
          gtcService: this.props.gtcService,
          listDialogKey: import_msfs_wtg3000_gtc.GtcViewKeys.ListDialog1,
          state: this[`field_${e.name}`],
          label: e.name,
          renderValue: (v) => v ? v.length > 1 ? v[1] : v[0] : e.displayFallback || "----",
          onSelected: (v) => {
            this[`field_${e.name}`].set(v);
            this.runValidCheck();
          },
          listParams: {
            title: e.name,
            inputData: e.options.map((x) => ({
              value: x,
              labelRenderer: () => x.length > 1 ? x[1] : x[0]
            }))
          }
        }
      ) : /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcValueTouchButton,
        {
          class: "item",
          state: this[`field_${e.name}`],
          label: e.name,
          renderValue: (v) => v ? v : e.displayFallback || "----",
          onPressed: async () => {
            let result = await this.props.gtcService.openPopup(e.type, "normal", "hide").ref.request({
              label: e.name,
              allowSpaces: e.allowSpaces || false,
              maxLength: e.maxLength || 4,
              initialValue: this[`field_${e.name}`].get(),
              initialInputText: this[`field_${e.name}`].get()
            });
            if (result.wasCancelled) {
              return;
            }
            this[`field_${e.name}`].set(
              e.transform ? e.transform(result.payload) : result.payload
            );
            this.runValidCheck();
            let x = e;
            let inc = 0;
            while (x.name.includes(`Remarks`) && result.payload.length === 12) {
              if (x.c === this.option.get().freeTextCount) break;
              x = this.fields.getArray()[i + ++inc];
              result = await this.props.gtcService.openPopup(x.type, "normal", "hide").ref.request({
                label: x.name,
                allowSpaces: x.allowSpaces || false,
                maxLength: x.maxLength || 4,
                initialValue: this[`field_${x.name}`].get(),
                initialInputText: this[`field_${x.name}`].get()
              });
              if (result.wasCancelled) {
                return;
              }
              this[`field_${x.name}`].set(
                e.transform ? e.transform(result.payload) : result.payload
              );
              this.runValidCheck();
            }
          },
          isInList: true
        }
      ));
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
        this[`field_${e.name}`] = import_msfs_sdk.Subject.create(
          (typeof e.initialValue === "function" ? e.initialValue() : e.initialValue) || ""
        );
      });
      this.option.set(opt);
      this.fields.clear();
      this.fields.insertRange(0, opt.fields);
      if (opt.freeText) {
        for (let i = 0; i < opt.freeTextCount; i++) {
          this[`field_Remarks ${i + 1}`] = import_msfs_sdk.Subject.create("");
          this.fields.insert({
            name: `Remarks ${i + 1}`,
            allowSpaces: true,
            maxLength: 12,
            c: i + 1,
            initialValue: "",
            displayFallback: "___",
            type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog
          });
        }
      }
      this.itemTitle.set(opt.title);
    }
    render() {
      const sidebarState = import_msfs_sdk.Subject.create(null);
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-message-dialog acars-message-dialog-popup" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "header" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent("span", null, this.itemTitle)), /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcList,
        {
          class: "list",
          ref: this.listRef,
          listItemSpacingPx: 5,
          sidebarState,
          bus: this.bus,
          data: this.fields,
          listItemHeightPx: this.listItemHeight,
          renderItem: this.renderItem.bind(this)
        }
      ), /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "footer" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcTouchButton,
        {
          label: this.buttonText,
          isEnabled: this.valid,
          onPressed: async () => {
            const opt = this.option.get();
            if (!opt.onSend) {
              this.props.gtcService.goBack();
            } else {
              this.buttonText.set("Sending");
              const f = Object.values(opt.fields).map((e) => [e.name, this[`field_${e.name}`]]).reduce((acc, val) => {
                acc[val[0]] = val[1].get();
                if (Array.isArray(acc[val[0]]))
                  acc[val[0]] = acc[val[0]][0];
                return acc;
              }, {});
              if (opt.freeText) {
                f["FreeText"] = Array(opt.freeTextCount).fill().map((_, i) => this[`field_Remarks ${i + 1}`].get()).filter((e) => e.length > 0).join("");
              }
              const res = await opt.onSend(f);
              if (res) {
                this.props.gtcService.goBack();
                this.props.gtcService.goBack();
              } else this.buttonText.set("Failed to send");
            }
          }
        }
      )));
    }
  };
  var AcarsSettingsPopUp = class extends import_msfs_wtg3000_gtc.GtcView {
    constructor(props2) {
      super(props2);
      this.listRef = import_msfs_sdk.FSComponent.createRef();
      this.listItemHeight = this.props.gtcService.orientation === "horizontal" ? 130 : 70;
      this.hoppieValue = import_msfs_sdk.Subject.create(
        this.props.settingsManager.getSetting("acars_code").get()
      );
      this.networkValue = import_msfs_sdk.Subject.create(
        this.props.settingsManager.getSetting("network").get()
      );
      this.simbriefId = import_msfs_sdk.Subject.create(
        this.props.settingsManager.getSetting("g3ka_simbrief_id").get()
      );
    }
    destroy() {
      const value = this.listRef.getOrDefault();
      if (value) value.destroy();
      super.destroy();
    }
    render() {
      const sidebarState = import_msfs_sdk.Subject.create(null);
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcList,
        {
          class: "acars-settings acars-settings-popup",
          ref: this.listRef,
          listItemSpacingPx: 1,
          sidebarState,
          bus: this.bus,
          itemsPerPage: 5,
          listItemHeightPx: this.listItemHeight
        },
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_wtg3000_gtc.GtcListItem, null, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          import_msfs_wtg3000_gtc.GtcValueTouchButton,
          {
            class: "acars-settings-button",
            label: "Hoppie Code",
            renderValue: (v) => v && v.length ? v : "----",
            state: this.hoppieValue,
            isInList: true,
            onPressed: async () => {
              const iff = document.createElement("input");
              iff.style.position = "absolute";
              iff.style.opacity = 0;
              document.body.appendChild(iff);
              iff.focus();
              const id = `${Date.now()}--hoppie-input`;
              Coherent.trigger("FOCUS_INPUT_FIELD", id, "", "", "", false);
              const result = await this.props.gtcService.openPopup(import_msfs_wtg3000_gtc.GtcViewKeys.MessageDialog1).ref.request({
                message: "Paste now to set Hoppie code, then press Okay"
              });
              Coherent.trigger("UNFOCUS_INPUT_FIELD", id);
              this.hoppieValue.set(iff.value);
              this.props.settingsManager.getSetting("acars_code").set(iff.value);
              SetStoredData("hoppie_code", iff.value);
              iff.remove();
            }
          }
        )),
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_wtg3000_gtc.GtcListItem, null, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          import_msfs_wtg3000_gtc.GtcValueTouchButton,
          {
            class: "acars-settings-button",
            label: "Simbrief Id",
            renderValue: (v) => v && v.length ? v : "----",
            state: this.simbriefId,
            isInList: true,
            onPressed: async () => {
              const result = await this.props.gtcService.openPopup(import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog, "normal", "hide").ref.request({
                label: "Simbrief Id",
                allowSpaces: false,
                maxLength: 10,
                initialValue: this.simbriefId.get(),
                initialInputText: this.simbriefId.get()
              });
              if (!result.wasCancelled) {
                this.simbriefId.set(result.payload);
                this.props.settingsManager.getSetting("g3ka_simbrief_id").set(result.payload);
                SetStoredData("g3ka_simbrief_id", result.payload);
              }
            }
          }
        )),
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_wtg3000_gtc.GtcListItem, null, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          import_msfs_wtg3000_gtc.GtcListSelectTouchButton,
          {
            isInList: true,
            class: "acars-settings-button",
            gtcService: this.props.gtcService,
            listDialogKey: import_msfs_wtg3000_gtc.GtcViewKeys.ListDialog1,
            state: this.networkValue,
            label: "Network",
            onSelected: (v) => {
              this.networkValue.set(v);
              this.props.settingsManager.getSetting("network").set(v);
              SetStoredData("g3ka_network", v);
            },
            listParams: {
              title: "Network",
              inputData: [
                { value: "hoppie", labelRenderer: (v) => "Hoppie" },
                {
                  value: "sayintentions",
                  labelRenderer: (v) => "Sayintentions"
                }
              ]
            }
          }
        ))
      );
    }
  };
  var AcarsMessageSendList = class extends import_msfs_wtg3000_gtc.GtcView {
    constructor(props2) {
      super(props2);
      this.listRef = import_msfs_sdk.FSComponent.createRef();
      this.listItemHeight = this.props.gtcService.orientation === "horizontal" ? 130 : 70;
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
      const sidebarState = import_msfs_sdk.Subject.create(null);
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcList,
        {
          class: "acars-settings acars-settings-popup",
          ref: this.listRef,
          listItemSpacingPx: 1,
          sidebarState,
          bus: this.bus,
          itemsPerPage: 5,
          listItemHeightPx: this.listItemHeight
        },
        this.props.items.map((e) => /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_wtg3000_gtc.GtcListItem, { key: e.title }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          import_msfs_wtg3000_gtc.GtcTouchButton,
          {
            class: "acars-settings-button",
            label: e.title,
            isInList: true,
            onPressed: () => {
              this.props.gtcService.openPopup("ACARS_SEND", "normal", "hide").ref.openForm(e);
            }
          }
        )))
      );
    }
  };
  var AcarsTabView = class extends import_msfs_wtg3000_gtc.GtcView {
    constructor(props2) {
      super(props2);
      this.tabsRef = import_msfs_sdk.FSComponent.createRef();
      this.settingsManager = new import_msfs_sdk.DefaultUserSettingManager(this.bus, [
        {
          defaultValue: GetStoredData("hoppie_code"),
          name: "acars_code"
        },
        {
          defaultValue: GetStoredData("g3ka_simbrief_id"),
          name: "g3ka_simbrief_id"
        },
        {
          defaultValue: GetStoredData("g3ka_network") || "hoppie",
          name: "network"
        }
      ]);
      const isPrimary = window.acarsSide !== "secondary";
      this.canCreate = import_msfs_sdk.Subject.create(false);
      this.client = import_msfs_sdk.Subject.create(null);
      this.distance = import_msfs_sdk.Subject.create(null);
      this.groundSpeed = import_msfs_sdk.Subject.create(null);
      if (isPrimary) {
        window.acarsSide = "primary";
        this.props.gtcService.bus.getPublisher().pub("acars_instance_create", {}, true, false);
      }
      this.latestMessage = import_msfs_sdk.Subject.create(null);
      const now = /* @__PURE__ */ new Date();
      this.depTime = import_msfs_sdk.Subject.create(now.getUTCHours() * 60 + now.getUTCMinutes());
      this.props.gtcService.bus.getSubscriber().on("lnavdata_waypoint_distance").handle((v) => {
        this.distance.set(v);
      });
      this.props.gtcService.bus.getSubscriber().on("ground_speed").handle((v) => {
        this.groundSpeed.set(v);
      });
      if (isPrimary) {
        this.props.gtcService.bus.getSubscriber().on("acars_state_request").handle((e) => {
          this.props.gtcService.bus.getPublisher().pub(
            "acars_state_response",
            { client: this.client.get() },
            true,
            false
          );
        });
      } else {
        const sub = this.props.gtcService.bus.getSubscriber().on("acars_state_response").handle((e) => {
          if (e.client) {
            this.props.gtcService.bus.getPublisher().pub("acars_status_param", {
              label: "Flight ID",
              value: e.client.callsign
            });
            props2.gtcService.bus.getPublisher().pub("acars_new_client", {
              callsign: e.client.callsign
            });
          }
          sub.destroy();
        });
        this.props.gtcService.bus.getPublisher().pub("acars_state_request", null, true, false);
      }
      if (isPrimary) {
        props2.gtcService.bus.getSubscriber().on("acars_message_ack").handle((v) => {
          const state = this.client.get();
          const message2 = state.message_stack[v.id];
          if (message2) {
            message2.response(v.e);
            message2.status.set("Closed");
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
            AircraftModels_default(),
            this.onMessage.bind(this),
            this.settingsManager.getSetting("network").get()
          );
          this.client.set(client);
          this.canCreate.set(true);
        });
        props2.gtcService.bus.getSubscriber().on("acars_message_request").handle((v) => {
          const state = this.client.get();
          state[v.key].apply(this, Object.values(v.arguments || {}));
        });
        props2.gtcService.bus.getSubscriber().on("acars_status_param").handle((imp) => {
          if (imp.label !== "Flight ID") return;
          const v = imp.value;
          const oldClient = this.client.get();
          if (oldClient) {
            oldClient.dispose();
          }
          const hoppieCode = this.settingsManager.getSetting("acars_code").get();
          if (v && v.length && hoppieCode) {
            const client = createClient(
              hoppieCode,
              v,
              AircraftModels_default(),
              this.onMessage.bind(this),
              this.settingsManager.getSetting("network").get()
            );
            this.client.set(client);
            props2.gtcService.bus.getPublisher().pub(
              "acars_new_client",
              {
                callsign: client.callsign
              },
              true,
              false
            );
            this.canCreate.set(true);
          } else {
            this.canCreate.set(false);
            this.client.set(null);
            props2.gtcService.bus.getPublisher().pub("acars_new_client", null, true, false);
          }
        });
      } else {
        props2.gtcService.bus.getSubscriber().on("acars_new_client").handle((v) => {
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
            "sendLogoffRequest"
          ];
          const client = {
            callsign: v.callsign,
            active_station: null,
            pending_station: null
          };
          for (const key of funcs) {
            client[key] = function() {
              props2.gtcService.bus.getPublisher().pub(
                "acars_message_request",
                {
                  key,
                  arguments
                },
                true,
                false
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
            const dt = /* @__PURE__ */ new Date();
            dt.setUTCHours(Math.floor(t / 60));
            dt.setUTCMinutes(Math.floor(t % 60));
            return client.sendPdc(
              d.Facility,
              d.Departure,
              d.Arrival,
              d.Stand,
              d.Atis,
              convertUnixToHHMM(dt.getTime()),
              d.FreeText
            );
          },
          fields: [
            {
              name: "Facility",
              allowSpaces: false,
              maxLength: 4,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "----",
              validate: (v) => v.length
            },
            {
              name: "Departure",
              allowSpaces: false,
              maxLength: 4,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "----",
              initialValue: () => {
                const fp = this.props.fms.getPrimaryFlightPlan();
                if (fp && fp.originAirportIcao) return fp.originAirportIcao.ident;
                return "";
              },
              validate: (v) => v.length
            },
            {
              name: "A/C Type",
              allowSpaces: false,
              maxLength: 4,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              initialValue: () => AircraftModels_default(),
              displayFallback: "----",
              validate: (v) => v.length
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
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "----",
              validate: (v) => v.length
            },
            {
              name: "Atis",
              allowSpaces: false,
              maxLength: 1,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-",
              validate: (v) => v.length
            },
            {
              name: "Stand",
              allowSpaces: true,
              maxLength: 10,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "----",
              validate: (v) => v.length
            }
          ]
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
              d["FreeText"]
            );
          },
          freeText: true,
          freeTextCount: 5,
          fields: [
            {
              name: "Callsign",
              allowSpaces: false,
              maxLength: 7,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "----",
              validate: (v) => v.length > 0,
              initialValue: () => {
                return this.client.get().callsign;
              }
            },
            {
              name: "Facility",
              allowSpaces: false,
              maxLength: 20,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "------",
              validate: (v) => v.length > 0
            },
            {
              name: "Entry Waypoint",
              allowSpaces: false,
              maxLength: 5,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-----",
              validate: (v) => v.length === 5
            },
            {
              name: "ETA",
              allowSpaces: false,
              maxLength: 12,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.DurationDialog1,
              displayFallback: "--:--",
              transform: (v) => `${v / 60}:${v % 60}`,
              validate: (v) => v.length
            },
            {
              name: "FL",
              allowSpaces: false,
              maxLength: 3,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "FL---",
              validate: (v) => v.length && !Number.isNaN(Number.parseInt(v))
            },
            {
              name: "Mach",
              allowSpaces: false,
              maxLength: 2,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: ".--",
              validate: (v) => v.length && !Number.isNaN(Number.parseInt(v))
            }
          ]
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
              d["Next Waypoint"]
            );
          },
          fields: [
            {
              name: "Mach",
              allowSpaces: false,
              maxLength: 4,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-----",
              validate: (v) => v.length && !Number.isNaN(Number.parseFloat(v)),
              initialValue: () => `${SimVar.GetSimVarValue("AIRSPEED MACH", "mach").toFixed(1)}`
            },
            {
              name: "FL",
              allowSpaces: false,
              maxLength: 5,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "---",
              transform: (v) => v.replace("FL", ""),
              validate: (v) => v.length && !Number.isNaN(Number.parseFloat(v)),
              inititalValue: () => {
                const v = SimVar.GetSimVarValue("INDICATED ALTITUDE", "feet");
                return (v / 100).toFixed(0);
              }
            },
            {
              name: "Waypoint",
              allowSpaces: false,
              maxLength: 10,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-----",
              validate: (v) => v.length,
              initialValue: () => {
                const fp = this.props.fms.getPrimaryFlightPlan();
                const leg = fp.getLeg(fp.activeLateralLeg);
                if (leg) return leg.name;
              }
            },
            {
              name: "Waypoint ATA",
              allowSpaces: false,
              maxLength: 10,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-----",
              validate: (v) => v.length,
              initialValue: () => {
                const time = /* @__PURE__ */ new Date();
                const rem = 60 * (this.distance.get() / this.groundSpeed.get());
                time.setUTCHours(time.getUTCHours() + Math.floor(rem / 60));
                time.setUTCMinutes(time.getUTCMinutes() + Math.floor(rem % 60));
                return `${time.getUTCHours().toString().padStart(2, "0")}${time.getUTCMinutes().toString().padStart(2, "0")}`;
              }
            },
            {
              name: "Following Waypoint",
              allowSpaces: false,
              maxLength: 10,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-----",
              validate: (v) => v.length,
              initialValue: () => {
                const fp = this.props.fms.getPrimaryFlightPlan();
                const leg = fp.getLeg(fp.activeLateralLeg + 1);
                if (leg) return leg.name;
              }
            },
            {
              name: "Following ETA",
              allowSpaces: false,
              maxLength: 10,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-----",
              validate: (v) => v.length,
              initialValue: () => {
                const fp = this.props.fms.getPrimaryFlightPlan();
                const leg = fp.getLeg(fp.activeLateralLeg + 1);
                if (!leg) return null;
                const time = /* @__PURE__ */ new Date();
                const rem = 60 * ((this.distance.get() + leg.calculated.distance / 1852) / this.groundSpeed.get());
                time.setUTCHours(time.getUTCHours() + Math.floor(rem / 60));
                time.setUTCMinutes(time.getUTCMinutes() + Math.floor(rem % 60));
                return `${time.getUTCHours().toString().padStart(2, "0")}${time.getUTCMinutes().toString().padStart(2, "0")}`;
              }
            },
            {
              name: "Next Waypoint",
              allowSpaces: false,
              maxLength: 10,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-----",
              validate: (v) => v.length,
              initialValue: () => {
                const fp = this.props.fms.getPrimaryFlightPlan();
                const leg = fp.getLeg(fp.activeLateralLeg + 2);
                if (leg) return leg.name;
              }
            }
          ]
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
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "----",
              validate: (v) => v.length === 4
            },
            {
              name: "Type",
              options: [["VATATIS", "ATIS"], ["METAR"], ["TAF"]],
              validate: (v) => true,
              initialValue: ["VATATIS", "ATIS"]
            }
          ]
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
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "----",
              validate: (v) => v.length > 0
            }
          ]
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
              d.FreeText
            );
          },
          freeText: true,
          freeTextCount: 5,
          fields: [
            {
              name: "FL",
              allowSpaces: false,
              maxLength: 3,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "FL---",
              validate: (v) => v.length && !Number.isNaN(Number.parseInt(v))
            },
            {
              name: "Change",
              options: [["Climb"], ["Descend"]],
              validate: (v) => true,
              initialValue: ["Climb"]
            },
            {
              name: "Reason",
              options: [
                ["weather", "Due to Weather"],
                ["performance", "Due to Aircraft Performance"]
              ],
              validate: (v) => true,
              initialValue: ["performance", "Due to Aircraft Performance"]
            }
          ]
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
              d.FreeText
            );
          },
          freeText: true,
          freeTextCount: 5,
          fields: [
            {
              name: "Speed",
              allowSpaces: false,
              maxLength: 5,
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "---",
              validate: (v) => v.length && !Number.isNaN(Number.parseInt(v))
            },
            {
              name: "Knots/Mach",
              options: [["Knots"], ["Mach"]],
              validate: (v) => true,
              initialValue: ["Mach"]
            },
            {
              name: "Reason",
              options: [
                ["weather", "Due to Weather"],
                ["performance", "Due to Aircraft Performance"]
              ],
              validate: (v) => true,
              initialValue: ["performance", "Due to Aircraft Performance"]
            }
          ]
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
              type: import_msfs_wtg3000_gtc.GtcViewKeys.TextDialog,
              displayFallback: "-----",
              validate: (v) => v.length >= 3
            },
            {
              name: "Reason",
              options: [
                ["weather", "Due to Weather"],
                ["performance", "Due to Aircraft Performance"]
              ],
              validate: (v) => true,
              initialValue: ["performance", "Due to Aircraft Performance"]
            }
          ]
        }
      ];
    }
    onMessage(message2) {
      this.bus.getPublisher().pub("acars_message", message2, true);
      this.latestMessage.set(message2);
      if (message2.type === "send") return;
      this.bus.getPublisher().pub(
        "cas_activate_alert",
        {
          key: { uuid: "acars-msg" },
          priority: import_msfs_sdk.AnnunciationType.Advisory
        },
        true,
        false
      );
      this.bus.getPublisher().pub("aural_alert_trigger", "acars-msg-sound", true, false);
    }
    onGtcInteractionEvent(event) {
      switch (event) {
        case import_msfs_wtg3000_gtc.GtcInteractionEvent.ButtonBarEnterPressed: {
          const msg = this.latestMessage.get();
          if (msg) {
            this.props.gtcService.openPopup("ACARS_MESSAGE_PAGE", "normal", "hide").ref.openMessage(message);
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
      const manager = new import_msfs_sdk.CasRegistrationManager(this.props.gtcService.bus);
      manager.register({
        uuid: "acars-msg",
        message: "DATALINK MESSAGE"
      });
      const audioManager = new import_msfs_sdk.AuralAlertRegistrationManager(
        this.props.gtcService.bus
      );
      audioManager.register({
        uuid: "acars-msg-sound",
        queue: "acars-queue",
        priority: 0,
        sequence: "tone_caution",
        continuous: false,
        repeat: false
      });
      this.props.gtcService.registerView(
        import_msfs_wtg3000_gtc.GtcViewLifecyclePolicy.Transient,
        "ACARS_SETTINGS",
        "MFD",
        (gtcService, controlMode, displayPaneIndex) => {
          return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
            AcarsSettingsPopUp,
            {
              settingsManager: this.settingsManager,
              gtcService,
              displayPaneIndex,
              controlMode
            }
          );
        },
        this.displayPaneIndex
      );
      this.props.gtcService.registerView(
        import_msfs_wtg3000_gtc.GtcViewLifecyclePolicy.Transient,
        "ACARS_SEND",
        "MFD",
        (gtcService, controlMode, displayPaneIndex) => {
          return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
            AcarsSendTemplate,
            {
              gtcService,
              displayPaneIndex,
              controlMode
            }
          );
        },
        this.displayPaneIndex
      );
      this.props.gtcService.registerView(
        import_msfs_wtg3000_gtc.GtcViewLifecyclePolicy.Transient,
        "ACARS_MESSAGE_OPT",
        "MFD",
        (gtcService, controlMode, displayPaneIndex) => {
          return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
            AcarsMessageSendList,
            {
              gtcService,
              displayPaneIndex,
              controlMode,
              items: this.options
            }
          );
        },
        this.displayPaneIndex
      );
      this.props.gtcService.registerView(
        import_msfs_wtg3000_gtc.GtcViewLifecyclePolicy.Transient,
        "ACARS_MESSAGE_PAGE",
        "MFD",
        (gtcService, controlMode, displayPaneIndex) => {
          return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
            AcarsMessagePage,
            {
              gtcService,
              displayPaneIndex,
              controlMode
            }
          );
        },
        this.displayPaneIndex
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
    }
    render() {
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "acars-page" }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.TabbedContainer,
        {
          class: "acars-page-tab-container",
          ref: this.tabsRef,
          configuration: "L5"
        },
        this.renderTab(1, "Status", this.renderStatusTab.bind(this)),
        this.renderTab(2, "CPDLC", this.renderCpdlcTab.bind(this))
      ), /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcTouchButton,
        {
          class: "acars-page-display-button2",
          label: "Create\nMessage",
          isVisible: true,
          isEnabled: this.canCreate,
          onPressed: () => {
            this.props.gtcService.openPopup("ACARS_MESSAGE_OPT");
          }
        }
      ), /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.GtcTouchButton,
        {
          class: "acars-page-display-button",
          label: "Options",
          isVisible: true,
          onPressed: () => {
            this.props.gtcService.openPopup("ACARS_SETTINGS");
          }
        }
      ));
    }
    renderTab(position, label, renderContent) {
      const contentRef = import_msfs_sdk.FSComponent.createRef();
      const sidebarState = import_msfs_sdk.Subject.create(null);
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_wtg3000_gtc.TabbedContent,
        {
          position,
          label,
          onPause: () => {
            this._activeComponent.set(null);
            sidebarState.set(null);
            contentRef.instance.onPause();
          },
          onResume: () => {
            this._activeComponent.set(contentRef.getOrDefault());
            sidebarState.set(this._sidebarState);
            contentRef.instance.onResume();
          },
          disabled: contentRef === void 0
        },
        renderContent && renderContent(contentRef, sidebarState)
      );
    }
    renderStatusTab(contentRef, sidebarState) {
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        StatusTab,
        {
          gtcService: this.props.gtcService,
          ref: contentRef,
          sidebarState,
          fms: this.props.fms,
          client: this.client,
          departureTime: this.depTime
        }
      );
    }
    renderCpdlcTab(contentRef, sidebarState) {
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        CpdlcTab,
        {
          gtcService: this.props.gtcService,
          ref: contentRef,
          sidebarState,
          fms: this.props.fms
        }
      );
    }
  };
  var AcarsTabView_default = AcarsTabView;

  // src/Interceptor.jsx
  var import_msfs_wtg3000_gtc2 = __require("@microsoft/msfs-wtg3000-gtc");

  // src/WeightAndBalance.mjs
  var import_msfs_wtg3000_common = __require("@microsoft/msfs-wtg3000-common");
  var import_msfs_garminsdk2 = __require("@microsoft/msfs-garminsdk");
  var import_msfs_sdk2 = __require("@microsoft/msfs-sdk");
  var loadFuelAndBalance = async (gtcService, instance) => {
    try {
      const response = await fetch(
        `https://www.simbrief.com/api/xml.fetcher.php?json=1&userid=${GetStoredData("g3ka_simbrief_id")}`
      );
      const json = await response.json();
      const { weights: weights2 } = json;
      const stations = getAircraftPayloadStations();
      const pub = gtcService.bus.getPublisher();
      const weightFuelSettingsManager = import_msfs_wtg3000_common.WeightFuelUserSettings.getManager(
        gtcService.bus
      );
      const unitsSettingManager = import_msfs_garminsdk2.UnitsUserSettings.getManager(gtcService.bus);
      const unit = json.params.units;
      const simUnitVar = unit === "kgs" ? "kilograms" : "pounds";
      const paxCount = Number.parseInt(weights2.pax_count_actual);
      const payloadTotal = Number.parseInt(weights2.payload);
      const cargo = Number.parseInt(weights2.cargo);
      if (paxCount > stations.pax.length) {
        const paxWeight2 = payloadTotal - cargo;
        const stationWeight = paxWeight2 / stations.pax.length;
        for (const station of stations.pax) {
          SimVar.SetSimVarValue(
            `PAYLOAD STATION WEIGHT:${station}`,
            simUnitVar,
            stationWeight
          );
        }
      } else {
        const paxWeight2 = Number.parseFloat(weights2.pax_weight);
        for (let i = 0; i < paxCount; i++) {
          SimVar.SetSimVarValue(
            `PAYLOAD STATION WEIGHT:${stations.pax[i]}`,
            simUnitVar,
            paxWeight2
          );
        }
      }
      const cargoStationWeight = cargo / stations.cargo.length;
      for (const station of stations.cargo) {
        SimVar.SetSimVarValue(
          `PAYLOAD STATION WEIGHT:${station}`,
          simUnitVar,
          cargoStationWeight
        );
      }
      const weightUnit = unitsSettingManager.weightUnits.get();
      const simBriefUnit = unit === "kgs" ? import_msfs_sdk2.UnitType.KILOGRAM : import_msfs_sdk2.UnitType.POUND;
      const paxWeight = Number.parseFloat(weights2.pax_weight);
      weightFuelSettingsManager.getSetting("weightFuelNumberPax").set(paxCount);
      weightFuelSettingsManager.getSetting("weightFuelAvgPax").set(simBriefUnit.convertTo(paxWeight, import_msfs_sdk2.UnitType.POUND));
      weightFuelSettingsManager.getSetting("weightFuelCargo").set(simBriefUnit.convertTo(cargo, import_msfs_sdk2.UnitType.POUND));
      const fuelTotal = Number.parseInt(json.fuel.plan_ramp);
      const fuel = fuelTotal / 2;
      const ratio = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", simUnitVar);
      SimVar.SetSimVarValue(
        "FUEL TANK LEFT MAIN QUANTITY",
        "gallons",
        fuel / ratio
      );
      SimVar.SetSimVarValue(
        "FUEL TANK RIGHT MAIN QUANTITY",
        "gallons",
        fuel / ratio
      );
      if (!instance)
        return true;
      await new Promise((r) => setTimeout(r, 2e3));
      instance.onFobSyncPressed();
      return true;
    } catch (err) {
      return false;
    }
  };

  // src/Interceptor.jsx
  var Proxy2 = class extends import_msfs_sdk3.DisplayComponent {
    render() {
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(import_msfs_sdk3.FSComponent.Fragment, null, this.props.children);
    }
  };
  var onSetupPage = (ctor, props2, service) => {
    if (!window.wtg3000gtc.GtcViewKeys.TextDialog)
      window.wtg3000gtc.GtcViewKeys.TextDialog = "KeyboardDialog";
    const rendered = new ctor(props2).render();
    return new Proxy2({
      children: [
        rendered,
        /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          import_msfs_garminsdk3.TouchButton,
          {
            label: "ACARS",
            class: "gtc-directory-button",
            onPressed: () => {
              service.changePageTo("CPDLC");
            }
          }
        )
      ]
    });
  };
  var WeightProxy = class extends import_msfs_sdk3.DisplayComponent {
    constructor(props2) {
      super(props2);
      this.textState = import_msfs_sdk3.Subject.create("LOAD UPLNK");
      this.canRequest = import_msfs_sdk3.Subject.create(true);
    }
    destroy() {
      if (this.tm) {
        clearTimeout(this.tm);
        this.tm = null;
      }
    }
    render() {
      const isSf50 = AircraftModels_default() === "SF50";
      if (isSf50) {
        return null;
      }
      return /* @__PURE__ */ msfssdk.FSComponent.buildComponent("div", { class: "wf-row", style: { display: "flex" } }, /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
        import_msfs_garminsdk3.TouchButton,
        {
          label: this.textState,
          isEnabled: this.canRequest,
          class: "wf-row wf-bottom-center-button",
          onPressed: () => {
            if (!this.canRequest.get()) return;
            if (this.tm) {
              clearTimeout(this.tm);
              this.tm = null;
            }
            this.textState.set("UPLNK\nLoading");
            this.canRequest.set(true);
            loadFuelAndBalance(this.props.service, this.props.instance).then((res) => {
              this.textState.set(res ? "UPLNK LOADED" : "LOAD FAILED");
              this.tm = setTimeout(() => {
                this.textState.set("LOAD UPLNK");
                this.tm = null;
              }, 1e4);
              this.canRequest.set(true);
            });
          }
        }
      ), this.props.originalRenderered);
    }
  };
  var onWeightPage = (ctor, props2, service, instance) => {
    const rendered = new ctor(props2).render();
    return new WeightProxy({
      originalRenderered: rendered,
      service,
      instance
    });
  };
  var onSetupPageLiv2AirCj3 = (ctor, props2, service) => {
    window.wtg3000gtc.GtcViewKeys.TextDialog = "KeyboardDialog";
    class BtnClass extends import_msfs_sdk3.DisplayComponent {
      render() {
        return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          import_msfs_garminsdk3.TouchButton,
          {
            label: "ACARS",
            class: "gtc-directory-button",
            onPressed: () => {
              service.changePageTo("CPDLC");
            }
          }
        );
      }
    }
    const instance = new ctor(props2);
    const btn = new BtnClass({ gtcService: service });
    const render = instance.render.bind(instance);
    instance.render = () => {
      const orig = render();
      orig.children[2].children = [btn.render()];
      return orig;
    };
    return instance;
  };
  var registerViews = (ctx, fms) => {
    ctx.registerView(
      import_msfs_wtg3000_gtc2.GtcViewLifecyclePolicy.Persistent,
      "CPDLC",
      "MFD",
      (gtcService, controlMode, displayPaneIndex) => {
        return /* @__PURE__ */ msfssdk.FSComponent.buildComponent(
          AcarsTabView_default,
          {
            gtcService,
            displayPaneIndex,
            controlMode,
            fms
          }
        );
      }
    );
  };

  // src/app.mjs
  var GarminAcarsPlugin = class extends import_msfs_wtg3000_gtc3.AbstractG3000GtcPlugin {
    constructor(binder) {
      super(binder);
      window.acarsClient = null;
      this.binder = binder;
      binder.gtcService.bus.getSubscriber().on("acars_instance_create").handle((v) => {
        if (window.acarsSide !== "primary") {
          window.acarsSide = "secondary";
        }
      });
      const title = SimVar.GetSimVarValue("TITLE", "string");
      if (title.includes("CJ3+"))
        this.onComponentCreating = (ctor, props2) => {
          if (ctor.name === "GtcWeightFuelPage") {
            this.weightFuelInstance = new ctor(props2);
            return this.weightFuelInstance;
          }
          if (ctor.name === "GtcTouchButton" && props2.label === "Set Empty\nWeight") {
            return onWeightPage(
              ctor,
              props2,
              this.binder.gtcService,
              this.weightFuelInstance
            );
          }
          if (ctor.name === "CustomGtcUtilitiesPage") {
            return onSetupPageLiv2AirCj3(
              ctor,
              props2,
              this.binder.gtcService,
              this.binder.fms
            );
          }
          return void 0;
        };
      else
        this.onComponentCreating = (ctor, props2) => {
          if (ctor.name === "GtcWeightFuelPage") {
            this.weightFuelInstance = new ctor(props2);
            return this.weightFuelInstance;
          }
          if (ctor.name === "GtcTouchButton" && props2.label === "Set Empty\nWeight") {
            return onWeightPage(
              ctor,
              props2,
              this.binder.gtcService,
              this.weightFuelInstance
            );
          }
          if (ctor.name === "GtcImgTouchButton" && props2.label === "Crew Profile") {
            return onSetupPage(
              ctor,
              props2,
              this.binder.gtcService,
              this.binder.fms
            );
          }
          return void 0;
        };
    }
    onInstalled() {
      this.loadCss("coui://html_ui/garmin-3000-acars/plugin.css");
    }
    registerGtcViews(ctx) {
      registerViews(ctx, this.binder.fms);
    }
  };
  import_msfs_sdk4.default.registerPlugin(GarminAcarsPlugin);
})();
