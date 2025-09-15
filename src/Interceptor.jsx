import { ImgTouchButton, TouchButton } from "@microsoft/msfs-garminsdk";
import { DisplayComponent, FSComponent } from "@microsoft/msfs-sdk";
import AcarsTabView from "./AcarsTabView";
import { GtcViewLifecyclePolicy } from "@microsoft/msfs-wtg3000-gtc";

class Proxy extends DisplayComponent {
  render() {
    return <FSComponent.Fragment>{this.props.children}</FSComponent.Fragment>;
  }
}
export const onSetupPage = (ctor, props, service) => {
  const rendered = new ctor(props).render();

  return new Proxy({
    children: [
      rendered,
      <TouchButton
        label={"ACARS"}
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
        <TouchButton
          label={"ACARS"}
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
};
