import { getAircraftPayloadStations } from "./AircraftModels.mjs";
import { WeightFuelUserSettings } from "@microsoft/msfs-wtg3000-common";
import { UnitsUserSettings } from "@microsoft/msfs-garminsdk";
import { UnitType } from "@microsoft/msfs-sdk";

export const loadFuelAndBalance = async (gtcService, instance) => {
  try {
    const response = await fetch(
      `https://www.simbrief.com/api/xml.fetcher.php?json=1&userid=${GetStoredData("g3ka_simbrief_id")}`,
    );
    const json = await response.json();
    const { weights } = json;
    const stations = getAircraftPayloadStations();
    const pub = gtcService.bus.getPublisher();
    const weightFuelSettingsManager = WeightFuelUserSettings.getManager(
      gtcService.bus,
    );
    const unitsSettingManager = UnitsUserSettings.getManager(gtcService.bus);
    const unit = json.params.units;
    const simUnitVar = unit === "kgs" ? "kilograms" : "pounds";
    const paxCount = Number.parseInt(weights.pax_count_actual);
    const payloadTotal = Number.parseInt(weights.payload);
    const cargo = Number.parseInt(weights.cargo);
    if (paxCount > stations.pax.length) {
      const paxWeight = payloadTotal - cargo;
      const stationWeight = paxWeight / stations.pax.length;
      for (const station of stations.pax) {
        SimVar.SetSimVarValue(
          `PAYLOAD STATION WEIGHT:${station}`,
          simUnitVar,
          stationWeight,
        );
      }
    } else {
      const paxWeight = Number.parseFloat(weights.pax_weight);
      for (let i = 0; i < paxCount; i++) {
        SimVar.SetSimVarValue(
          `PAYLOAD STATION WEIGHT:${stations.pax[i]}`,
          simUnitVar,
          paxWeight,
        );
      }
    }
    const cargoStationWeight = cargo / stations.cargo.length;
    for (const station of stations.cargo) {
      SimVar.SetSimVarValue(
        `PAYLOAD STATION WEIGHT:${station}`,
        simUnitVar,
        cargoStationWeight,
      );
    }
    const weightUnit = unitsSettingManager.weightUnits.get();
    const simBriefUnit = unit === "kgs" ? UnitType.KILOGRAM : UnitType.POUND;
    const paxWeight = Number.parseFloat(weights.pax_weight);

    weightFuelSettingsManager.getSetting("weightFuelNumberPax").set(paxCount);
    weightFuelSettingsManager
      .getSetting("weightFuelAvgPax")
      .set(simBriefUnit.convertTo(paxWeight, UnitType.POUND));
    weightFuelSettingsManager
      .getSetting("weightFuelCargo")
      .set(simBriefUnit.convertTo(cargo, UnitType.POUND));

    const fuelTotal = Number.parseInt(json.fuel.plan_ramp);
    const fuel = fuelTotal / 2;
    const ratio = SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", simUnitVar);
    SimVar.SetSimVarValue(
      "FUEL TANK LEFT MAIN QUANTITY",
      "gallons",
      fuel / ratio,
    );
    SimVar.SetSimVarValue(
      "FUEL TANK RIGHT MAIN QUANTITY",
      "gallons",
      fuel / ratio,
    );

    if(!instance)
      return true;
    await new Promise(r => setTimeout(r, 2000));
    // instance.fuelOnBoardWeightSetting.set(simBriefUnit.convertTo(fuelTotal, UnitType.POUND));

    // weightFuelSettingsManager
    //   .getSetting("weightFuelInitialFob")
    //   .set(simBriefUnit.convertTo(fuelTotal, UnitType.POUND));
    // pub.pub(
    //   "weightfuel_fob_weight",
    //   simBriefUnit.convertTo(fuelTotal, UnitType.POUND),
    //   true,
    //   false,
    // );
    // instance.fuelOnBoardWeightSource.value =
    //   simBriefUnit.convertTo(fuelTotal, UnitType.POUND)
    // ;
    instance.onFobSyncPressed();

    return true;
  } catch (err) {
    return false;
  }
};
