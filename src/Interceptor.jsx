import { ImgTouchButton, TouchButton } from "@microsoft/msfs-garminsdk";
import { DisplayComponent, FSComponent, Subject } from "@microsoft/msfs-sdk";
import AcarsTabView, {
  AcarsSettingsPopUp,
  getSettingsManager,
  GtcCpdlcAltitudeDialog,
} from "./AcarsTabView";
import { GtcLoadFrequencyDialog, GtcViewKeys, GtcViewLifecyclePolicy } from "@microsoft/msfs-wtg3000-gtc";
import { loadFuelAndBalance } from "./WeightAndBalance.mjs";
import getAircraftIcao from "./AircraftModels.mjs";

class Proxy extends DisplayComponent {
  render() {
    return <FSComponent.Fragment>{this.props.children}</FSComponent.Fragment>;
  }
}

export const onMfdHomePage = (ctor, props, service) => {
  if (!window.wtg3000gtc.GtcViewKeys.TextDialog)
    window.wtg3000gtc.GtcViewKeys.TextDialog = "KeyboardDialog";
  const rendered = new ctor(props).render();

  return new Proxy({
    children: [
      rendered,
      <ImgTouchButton
        label={"CPDLC"}
        imgSrc={"coui://html_ui/garmin-3000-acars/assets/tower.png"}
        class={"gtc-directory-button"}
        onPressed={() => {
          service.changePageTo("CPDLC");
        }}
      />,
    ],
  });
};

export const onSetupPageLiv2AirCj3 = (ctor, props, service) => {
  // ??????????????????????????????
  window.wtg3000gtc.GtcViewKeys.TextDialog = "KeyboardDialog";
  class BtnClass extends DisplayComponent {
    render() {
      return (
        <ImgTouchButton
          label={"CPDLC"}
          imgSrc={"coui://html_ui/garmin-3000-acars/assets/tower.png"}
          class={"gtc-directory-button"}
          onPressed={() => {
            service.changePageTo("CPDLC");
          }}
        />
      );
    }
  }
  const instance = new ctor(props);
  const btn = new BtnClass({ gtcService: service });
  const render = instance.render.bind(instance);
  instance.render = () => {
    const orig = render();
    orig.children[2].children = [btn.render()];
    return orig;
  };
  return instance;
};

class WeightProxy extends DisplayComponent {
  constructor(props) {
    super(props);
    this.textState = Subject.create("LOAD UPLNK");
    this.canRequest = Subject.create(true);
  }
  destroy() {
    if (this.tm) {
      clearTimeout(this.tm);
      this.tm = null;
    }
  }
  render() {
    const isSf50 = getAircraftIcao() === "SF50";
    if (isSf50) {
      return null;
    }
    return (
      <div class="wf-row" style={{ display: "flex" }}>
        <TouchButton
          label={this.textState}
          isEnabled={this.canRequest}
          class={"wf-row wf-bottom-center-button"}
          onPressed={() => {
            if (!this.canRequest.get()) return;
            if (this.tm) {
              clearTimeout(this.tm);
              this.tm = null;
            }
            this.textState.set("UPLNK\nLoading");
            this.canRequest.set(true);
            loadFuelAndBalance(this.props.service, this.props.instance).then(
              (res) => {
                this.textState.set(res ? "UPLNK LOADED" : "LOAD FAILED");
                this.tm = setTimeout(() => {
                  this.textState.set("LOAD UPLNK");
                  this.tm = null;
                }, 10000);
                this.canRequest.set(true);
              },
            );
          }}
        />
        {this.props.originalRenderered}
      </div>
    );
  }
}
export const onWeightPage = (ctor, props, service, instance) => {
  const rendered = new ctor(props).render();
  return new WeightProxy({
    originalRenderered: rendered,
    service,
    instance,
  });
};

// Data Link Settings button for Setup page
class DataLinkSettingsButton extends DisplayComponent {
  render() {
    return (
      <ImgTouchButton
        label={"Datalink\nSettings"}
        imgSrc={"coui://html_ui/garmin-3000-acars/assets/tower.png"}
        class={"gtc-directory-button"}
        onPressed={() => {
          this.props.service.openPopup("ACARS_SETTINGS");
        }}
      />
    );
  }
}

// Proxy that wraps Setup page and adds Data Link Settings button
class SetupPageProxy extends DisplayComponent {
  render() {
    return (
      <FSComponent.Fragment>
        {this.props.originalRendered}
        <DataLinkSettingsButton service={this.props.service} />
      </FSComponent.Fragment>
    );
  }
}

export const onSetupPage = (ctor, props, service) => {
  const instance = new ctor(props);
  const originalRender = instance.render.bind(instance);

  instance.render = () => {
    const orig = originalRender();
    // Add the Data Link Settings button to the second row
    if (orig.children && orig.children[1] && orig.children[1].children) {
      orig.children[1].children.push(
        <DataLinkSettingsButton service={service} />,
      );
    }
    return orig;
  };

  return instance;
};

export const registerViews = (ctx, fms) => {
  ctx.registerView(
    GtcViewLifecyclePolicy.Persistent,
    "CPDLC",
    "MFD",
    (gtcService, controlMode, displayPaneIndex) => {
      return (
        <AcarsTabView
          gtcService={gtcService}
          displayPaneIndex={displayPaneIndex}
          controlMode={controlMode}
          fms={fms}
        />
      );
    },
  );
  ctx.registerView(
    GtcViewLifecyclePolicy.Transient,
    "ACARS_SETTINGS",
    "MFD",
    (gtcService, controlMode, displayPaneIndex) => {
      return (
        <AcarsSettingsPopUp
          settingsManager={getSettingsManager(gtcService.bus)}
          gtcService={gtcService}
          displayPaneIndex={displayPaneIndex}
          controlMode={controlMode}
        />
      );
    },
  );
  ctx.registerView(
    GtcViewLifecyclePolicy.Persistent,
    "ACARS_ENTRY_ALTITUDE",
    "MFD",
    (gtcService, controlMode, displayPaneIndex) => {
      return (
        <GtcCpdlcAltitudeDialog
          gtcService={gtcService}
          controlMode={controlMode}
          displayPaneIndex={displayPaneIndex}
        />
      );
    },
  );
};
