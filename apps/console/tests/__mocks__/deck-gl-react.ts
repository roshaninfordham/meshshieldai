import React from "react";
const DeckGL = ({ children, ...props }: any) => React.createElement("div", { "data-testid": "dg", ...props }, children);
export default DeckGL;
