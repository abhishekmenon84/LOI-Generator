import { Text } from "@react-pdf/renderer";

// A diagonal, semi-transparent "sample" stamp repeated on every page of a
// @react-pdf/renderer document via the `fixed` prop (renders once per page
// automatically). Used only for org-trial-period PDF exports in this round —
// the full free-vs-paid personal-account watermark system remains
// unbuilt/out of scope (see Global Constraints).
export function SampleWatermark() {
  return (
    <Text
      fixed
      style={{
        position: "absolute",
        top: "45%",
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: 46,
        fontFamily: "Helvetica-Bold",
        color: "#cc0000",
        opacity: 0.28,
        transform: "rotate(-38deg)",
      }}
    >
      SAMPLE — LOI BUILDER
    </Text>
  );
}
