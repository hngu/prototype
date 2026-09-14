import { useState } from "react";
import styled from "@emotion/styled";

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
`;

const Channel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Preview = styled.div<{ $color: string }>`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: ${(p) => p.$color};
`;

export const ColorPicker = () => {
  const [red, setRed] = useState(0);
  const [green, setGreen] = useState(0);
  const [blue, setBlue] = useState(0);

  return (
    <Root>
      <Preview $color={`rgb(${red}, ${green}, ${blue})`} />
      <Channel>
        Red
        <input
          type="range"
          min={0}
          max={255}
          value={red}
          onChange={(e) => setRed(parseInt(e.target.value, 10))}
        />
      </Channel>
      <Channel>
        Green
        <input
          type="range"
          min={0}
          max={255}
          value={green}
          onChange={(e) => setGreen(parseInt(e.target.value, 10))}
        />
      </Channel>
      <Channel>
        Blue
        <input
          type="range"
          min={0}
          max={255}
          value={blue}
          onChange={(e) => setBlue(parseInt(e.target.value, 10))}
        />
      </Channel>
    </Root>
  );
};
