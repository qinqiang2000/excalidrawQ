import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";
import { ExcalidrawPlusAppLink } from "./ExcalidrawPlusAppLink";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    // Get deployment timestamp for build verification
    const deployTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
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
          <div
            style={{
              fontSize: "10px",
              color: "var(--color-gray-40)",
              opacity: 0.7,
              marginLeft: "8px",
            }}
            title={`构建时间: ${deployTime}`}
          >
            🚀 {deployTime.slice(5, 16)}
          </div>
        </div>
      </Footer>
    );
  },
);
