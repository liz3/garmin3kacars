import msfsSdk from "@microsoft/msfs-sdk";
import {
  AbstractG3000GtcPlugin,
  GtcViewLifecyclePolicy,
} from "@microsoft/msfs-wtg3000-gtc";
import { onSetupPage, registerViews } from "./Interceptor";
import "./acars-style.css"

class GarminAcarsPlugin extends AbstractG3000GtcPlugin {
  constructor(binder) {
    super(binder);
    this.binder = binder;
    this.onComponentCreating = (ctor, props) => {
      if (ctor.name === "GtcImgTouchButton" && props.label === "Crew Profile") {
        return onSetupPage(ctor, props, this.binder.gtcService, this.binder.fms);
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
