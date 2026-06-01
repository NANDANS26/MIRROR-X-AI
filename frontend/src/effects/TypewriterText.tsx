import {
  useEffect,
  useState,
} from "react";

interface Props {
  text: string;
}

export default function TypewriterText({
  text,
}: Props) {
  const [display, setDisplay] =
    useState("");

  useEffect(() => {
    let index = 0;

    setDisplay("");

    const interval =
      setInterval(() => {
        index++;

        setDisplay(
          text.slice(0, index)
        );

        if (
          index >= text.length
        ) {
          clearInterval(
            interval
          );
        }
      }, 15);

    return () =>
      clearInterval(
        interval
      );
  }, [text]);

  return <span>{display}</span>;
}