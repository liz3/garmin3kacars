import msfsSdk from "@microsoft/msfs-sdk";
import {
  AbstractG3000GtcPlugin,
  GtcViewLifecyclePolicy,
} from "@microsoft/msfs-wtg3000-gtc";
import {
  onSetupPage,
  onSetupPageLiv2AirCj3,
  onWeightPage,
  registerViews,
} from "./Interceptor";
import "./acars-style.css";

class GarminAcarsPlugin extends AbstractG3000GtcPlugin {
  constructor(binder) {
    super(binder);
    window.acarsClient = null;
    this.binder = binder;
    binder.gtcService.bus
      .getSubscriber()
      .on("acars_instance_create")
      .handle((v) => {
        if (window.acarsSide !== "primary") {
          window.acarsSide = "secondary";
        }
      });
    const title = SimVar.GetSimVarValue("TITLE", "string");
    if (title.includes("CJ3+"))
      this.onComponentCreating = (ctor, props) => {
      if (ctor.name === "GtcWeightFuelPage") {
          this.weightFuelInstance = new ctor(props);
          return this.weightFuelInstance;
        }
        if (
          ctor.name === "GtcTouchButton" &&
          props.label === "Set Empty\nWeight"
        ) {
          return onWeightPage(
            ctor,
            props,
            this.binder.gtcService,
            this.weightFuelInstance,
          );
        }
        if (ctor.name === "CustomGtcUtilitiesPage") {
          return onSetupPageLiv2AirCj3(
            ctor,
            props,
            this.binder.gtcService,
            this.binder.fms,
          );
        }
        return undefined;
      };
    else
      this.onComponentCreating = (ctor, props) => {
        if (ctor.name === "GtcWeightFuelPage") {
          this.weightFuelInstance = new ctor(props);
          return this.weightFuelInstance;
        }
        if (
          ctor.name === "GtcTouchButton" &&
          props.label === "Set Empty\nWeight"
        ) {
          return onWeightPage(
            ctor,
            props,
            this.binder.gtcService,
            this.weightFuelInstance,
          );
        }
        if (
          ctor.name === "GtcImgTouchButton" &&
          props.label === "Crew Profile"
        ) {
          return onSetupPage(
            ctor,
            props,
            this.binder.gtcService,
            this.binder.fms,
          );
        }
        return undefined;
      };
  }
  onInstalled() {
    this.loadCss("coui://html_ui/garmin-3000-acars/plugin.css");
  }

  registerGtcViews(ctx) {
    registerViews(ctx, this.binder.fms);
  }
}
msfsSdk.registerPlugin(GarminAcarsPlugin);
