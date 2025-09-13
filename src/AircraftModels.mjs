const models = {
  "Asobo Cessna Citation Longitude": "C700",
  "Microsoft Vision Jet": "SF50",
  "Asobo TBM 930": "TMB9"
}

const getAircraftIcao = () => {
  const v = SimVar.GetSimVarValue("TITLE", "string");
  for(const k in models){
    if(v.includes(k))
      return models[k];
  }
  return "";
}
export default getAircraftIcao;