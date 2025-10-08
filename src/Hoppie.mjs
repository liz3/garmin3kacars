const parseMessages = (input) => {
  const messagePattern = /\{(\w+)\s+(\w+)\s+\{([^}]+)\}\}/g;
  let match;
  const messages = [];

  while ((match = messagePattern.exec(input)) !== null) {
    const message = {
      ts: Date.now(),
      from: match[1],
      type: match[2],
      payload: match[3],
    };
    if (message.type === "cpdlc" || message.type === "telex") {
      const parts = message.payload.split("/");
      if (message.type === "cpdlc") {
        message.cpdlc = {
          protocol: parts[1],
          min: parts[2],
          mrn: parts[3],
          ra: parts[4],
          content: parts[5],
        };
        message.content = message.cpdlc.content;
        if (message.content) {
          message.content = message.content.replace(/@/g, "");
        }
      } else {
        const nonEmptyParts = parts.filter((part) => part !== "");
        message.content = nonEmptyParts.pop();
      }
    } else {
      message.content = message.payload;
    }
    messages.push(message);
  }
  return messages;
};

const sendAcarsMessage = async (state, receiver, payload, messageType) => {
  const params = new URLSearchParams([
    ["logon", state.code],
    ["from", state.callsign],
    ["type", messageType],
    ["to", receiver],
    ["packet", payload],
  ]);
  return fetch(`${state._service_url}?${params.toString()}`, {
    method: "GET",
  });
};

const responseOptions = (c) => {
  const map = {
    WU: ["WILCO", "UNABLE"],
    AN: ["AFFIRMATIVE", "NEGATIVE"],
    R: ["ROGER", "UNABLE"],
    RA: ["ROGER", "UNABLE"],
    Y: ["YES", "NO"],
    N: ["YES", "NO"],
  };
  if (map[c]) return [...map[c], "STANDBY"];
  return null;
};

const forwardStateUpdate = (state) => {
  if (state._stationCallback)
    state._stationCallback({
      active: state.active_station,
      pending: state.pending_station,
    });
};

export const messageStateUpdate = (state, message) => {
  if (
    message.type === "cpdlc" &&
    message.content === "LOGON ACCEPTED" &&
    state.pending_station
  ) {
    state.active_station = message.from;
    state.pending_station = null;
    forwardStateUpdate(state);
  } else if (
    message.type === "cpdlc" &&
    message.content === "LOGOFF" &&
    state.active_station
  ) {
    state.active_station = null;
    state.pending_station = null;
    forwardStateUpdate(state);
  }
};

const cpdlcStringBuilder = (state, request, replyId = "") => {
  if (state._min_count === 63) {
    state._min_count = 0;
  }
  state._min_count++;
  return `/data2/${state._min_count}/${replyId}/N/${request}`;
};

const poll = (state) => {
  state._interval = setTimeout(() => {
    sendAcarsMessage(state, "SERVER", "Nothing", "POLL")
      .then((response) => {
        if (response.ok) {
          response
            .text()
            .then((raw) => {
              for (const message of parseMessages(raw)) {
                if (
                  message.from === state.callsign &&
                  message.type === "inforeq"
                ) {
                  continue;
                }
                if (
                  state.active_station &&
                  message.from === state.active_station &&
                  message.content.startsWith("HANDOVER")
                ) {
                  state.active_station = null;
                  const station = message.content.split(" ")[1];
                  if (station) {
                    const corrected = station.trim().replace("@", "");
                    state.sendLogonRequest(corrected);
                    return;
                  }
                }
                message._id = state.idc++;
                messageStateUpdate(state, message);
                if (message.type === "cpdlc" && message.cpdlc.ra) {
                  const opts = responseOptions(message.cpdlc.ra);
                  if (opts)
                    message.response = async (code) => {
                      message.respondSend = code;
                      if (state._min_count === 63) {
                        state._min_count = 0;
                      }
                      state._min_count++;
                      sendAcarsMessage(
                        state,
                        message.from,
                        `/data2/${state._min_count}/${message.cpdlc.min}/${code === "STANDBY" ? "NE" : "N"}/${code}`,
                        "cpdlc",
                      );
                    };
                  message.options = opts;
                  message.respondSend = null;
                }
                state.message_stack[message._id] = message;
                state._callback(message);
              }
              poll(state);
            })
            .catch((err) => {
              poll(state);
            });
        } else {
          poll(state);
        }
      })
      .catch((err) => {
        poll(state);
      });
  }, 10000);
};

const addMessage = (state, content) => {
  state._callback({
    type: "send",
    content,
    from: state.callsign,
    ts: Date.now(),
  });
  return content;
};

export const convertUnixToHHMM = (unixTimestamp) => {
  const date = new Date(unixTimestamp);

  let hours = date.getUTCHours();
  let minutes = date.getUTCMinutes();

  hours = hours.toString().padStart(2, "0");
  minutes = minutes.toString().padStart(2, "0");

  return `${hours}:${minutes}`;
};

const SERVICES = {
  hoppie: "https://www.hoppie.nl/acars/system/connect.html",
  sayintentions: " https://acars.sayintentions.ai/acars/system/connect.html",
};

export const createClient = (
  code,
  callsign,
  aicraftType,
  messageCallback,
  service = "hoppie",
) => {
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
    _service_url: SERVICES[service],
  };

  state.dispose = () => {
    if (state._interval) clearInterval(state._interval);
    state._interval = null;
  };

  state.sendTelex = async (to, message) => {
    const response = await sendAcarsMessage(
      state,
      to,
      addMessage(state, message.toUpperCase()),
      "telex",
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
      "inforeq",
    );
    if (!response.ok) return false;
    const text = await response.text();
    for (const message of parseMessages(text)) {
      state._callback(message);
    }
    return text.startsWith("ok");
  };

  state.sendPositionReport = async (
    fl,
    mach,
    wp,
    wpEta,
    nextWp,
    nextWpEta,
    followWp,
  ) => {
    if (!state.active_station) return;
    const content =
      `OVER ${wp} AT ${wpEta}Z FL${fl}, ESTIMATING ${nextWp} AT ${nextWpEta}Z, THEREAFTER ${followWp}. CURRENT SPEED M${mach}`.toUpperCase();
    const response = await sendAcarsMessage(
      state,
      state.active_station,
      `/DATA1/*/*/*/*/FL${fl}/*/${mach}/\n\n${content}`,
      "position",
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
      "cpdlc",
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
      "cpdlc",
    );
    if (!response.ok) return false;
    const text = await response.text();
    forwardStateUpdate(state);
    return text.startsWith("ok");
  };

  state.sendOceanicClearance = async (
    cs,
    to,
    entryPoint,
    eta,
    level,
    mach,
    freeText,
  ) => {
    const response = await sendAcarsMessage(
      state,
      to,
      addMessage(
        state,
        `REQUEST OCEANIC CLEARANCE ${cs} ${state.aircraft} ESTIMATING ${entryPoint} AT ${eta}Z FLIGHT LEVEL ${lvl} REQUEST MACH ${mach}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase(),
      ),
      "telex",
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
        `REQUEST PREDEP CLEARANCE ${state.callsign} ${state.aircraft} TO ${arr} AT ${dep} ${stand} ATIS ${atis} ${eob}Z${freeText.length ? ` ${freeText}` : ""}`.toUpperCase(),
      ),
      "telex",
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
          `REQUEST ${climb ? "CLIMB" : "DESCEND"} TO FL${lvl} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase(),
        ),
      ),
      "cpdlc",
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
          `REQUEST ${unit === "knots" ? `${value} kts` : `M${value}`} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase(),
        ),
      ),
      "cpdlc",
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
          `REQUEST DIRECT TO ${waypoint} DUE TO ${{ weather: "weather", performance: "aircraft performance" }[reason.toLowerCase()]}${freeText.length ? ` ${freeText}` : ""}`.toUpperCase(),
        ),
      ),
      "cpdlc",
    );
    if (!response.ok) return false;
    const text = await response.text();
    return text.startsWith("ok");
  };

  poll(state);
  return state;
};
