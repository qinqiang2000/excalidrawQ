import { Button, Footer } from "@excalidraw/excalidraw/index";
import React, { useCallback } from "react";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useExcalidrawActionManager } from "@excalidraw/excalidraw/components/App";
import { actionPresent } from "@excalidraw/excalidraw/actions";
import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { presentIcon } from "@excalidraw/excalidraw/components/icons";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";
import { ExcalidrawPlusAppLink } from "./ExcalidrawPlusAppLink";
import { RecentFilesButton } from "./RecentFilesButton";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    const { t } = useI18n();
    const actionManager = useExcalidrawActionManager();
    const onPresent = useCallback(
      () => actionManager.executeAction(actionPresent),
      [actionManager],
    );

    const presentShortcut = getShortcutFromShortcutName("present");
    const presentTooltip = presentShortcut
      ? `${t("labels.present")} (${presentShortcut})`
      : t("labels.present");

    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {isExcalidrawPlusSignedUser ? (
            <ExcalidrawPlusAppLink />
          ) : (
            <EncryptedIcon />
          )}
          <RecentFilesButton />
          <Button
            onSelect={onPresent}
            style={{ width: "fit-content" }}
            title={presentTooltip}
          >
            {presentIcon}
          </Button>
        </div>
      </Footer>
    );
  },
);
