const models = {
  "Longitude": "C700",
  "Vision Jet": "SF50",
  "TBM 930": "TMB9",
  "CJ3+": "C25B",
};
const weights = {
  "Longitude": {
    pax: [3, 5, 4, 6, 7, 9, 8, 10],
    cargo: [11, 12],
  },

  "TBM 930": {
    pax: [2, 3, 4, 5, 6],
    cargo: [7, 8],
  },
  "CJ3+": {
    pax: [1,2,3,4,5,6,7,8.9],
    cargo: [10, 11],
  },
};

const getAircraftIcao = () => {
  const v = SimVar.GetSimVarValue("TITLE", "string");
  for (const k in models) {
    if (v.includes(k)) return models[k];
  }
  return "";
};

export const getAircraftPayloadStations = () => {
  const v = SimVar.GetSimVarValue("TITLE", "string");
  for (const k in weights) {
    if (v.includes(k)) return weights[k];
  }
  return null;
};
export default getAircraftIcao;
