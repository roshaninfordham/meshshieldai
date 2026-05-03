import React from "react";
export const Map = ({ children, ...props }: any) => React.createElement("div", { "data-testid": "map", ...props }, children);
