import * as React from "react";
import * as d3 from "d3";

import { ECGChartProps, ECGToolbarProps } from "./types";
import { useD3 } from "../../../common/hooks/useD3";

/**
 * This function will rearrange the order of arrays in the buffer based on the channelOrder.
 * @param channelOrder
 * @param buffer
 * @returns
 */
const rearrangeBuffer = (channelOrder: string[], buffer: number[][]) => {
  const channelCorrectOrder: string[] = [
    "I",
    "II",
    "III",
    "AVR",
    "AVL",
    "AVF",
    "V1",
    "V2",
    "V3",
    "V4",
    "V5",
    "V6",
  ];

  // Create a mapping of elements in the first array to their indices in channelCorrectOrder
  const mapping: { [key: string]: number } = {};
  const upperChannelOrder = channelOrder.map((channel) =>
    channel.toUpperCase()
  );
  for (const leadNumber of channelCorrectOrder) {
    if (upperChannelOrder.includes(leadNumber))
      mapping[leadNumber] = upperChannelOrder.indexOf(leadNumber);
  }

  return {
    rearrangedChannels: Object.keys(mapping),
    rearrangedBuffer: Object.values(mapping).map((i: number) => buffer[i]),
  };
};

export function ECGChart(props: ECGChartProps): React.ReactElement {
  /**
   * This ECG chart follows the conventions outlined below:
   * 0.04 seconds per 1 small horizontal box
   * 0.20 seconds per 1 big horizontal box
   * 0.1mV per 1 small vertical box
   * 0.5mV per 1 big vertical box
   */

  const X_BOX = 0.04; // 1 small box, i: numbern s
  const Y_BOX = 0.1; // 1 small box, i: numbern mV
  const MINMV = -0.5;
  const MAXMV = 2.5;
  const DEFAULT_BOX_SIZE = 8;

  const GRIDLINE_COLOR = "red";
  const MARGINS = { LEFT: 5, RIGHT: 5, TOP: 5, BOTTOM: 5 };

  const handleZoomIn = (zoom: string) => {};
  const handleZoomOut = (zoom: string) => {};

  const chartRef = useD3(
    (svg: d3.Selection<SVGElement, {}, HTMLElement, any>) => {
      if (!props.data) return;
      if (!svg.selectAll("#ecg-chart-svg").empty())
        svg.selectAll("#ecg-chart-svg").remove(); // removes any overlapping versions of the svgs

      let { rearrangedChannels, rearrangedBuffer } = rearrangeBuffer(
        props.data.channels.map((entry) => entry.label),
        props.data.buffer
      );
      const numLeads: number = rearrangedBuffer.length;

      const bufferTime: number[][] = rearrangedBuffer.map(
        (entry: number[], leadIndex: number) =>
          entry.map(
            (_, i: number) =>
              i * (1 / props.data!.channels[leadIndex].sample_rate)
          )
      ); // The x values for our plots

      // We adopt single chart axis (not multi lead y axis, for easier calculation)
      // We later offset the amount of the lead by the chartHeight
      const maxXValue = Math.max(
        ...bufferTime.map((entry) => Math.max(...entry))
      );
      const xDomain = [0, X_BOX * Math.ceil(maxXValue / X_BOX)];
      const yDomain = [MINMV, MAXMV + (Math.abs(MINMV) + MAXMV) * numLeads];

      const numXGrids = xDomain[1] / X_BOX; // The number of small x grids we need to plot
      const numYGrids = numLeads * ((Math.abs(MINMV) + MAXMV) / Y_BOX); // The number of small y grids we need to plot for one channel chart
      const chartWidth = numXGrids * DEFAULT_BOX_SIZE;
      const chartHeight = numYGrids * DEFAULT_BOX_SIZE; // The total pixel size in height we want to plot for one channel chart

      const x = d3.scaleLinear().range([0, chartWidth]).domain(xDomain);
      const y = d3
        .scaleLinear()
        .range([chartHeight, 0]) // Chart is anchored to top
        .domain(yDomain);

      // Final calculated chart width and height with margins
      const HEIGHT = chartHeight + MARGINS.TOP + MARGINS.BOTTOM;
      const WIDTH = chartWidth + MARGINS.LEFT + MARGINS.RIGHT;

      const strokePattern = (_: any, i: number) =>
        i % 5 === 0 ? "0.8px" : "0.3px";

      svg
        .attr("width", WIDTH)
        .attr("height", HEIGHT)
        .attr("id", "ecg-chart-svg");

      const generateXAxis = (numGrids: number) => {
        // ticks will only ever return multiples of 5, 10. See mike bostock https://stackoverflow.com/questions/13100314/change-the-ticks-on-x-axis/13102118#13102118
        // in this case, we use tickValues to avoid that
        return d3
          .axisBottom(x)
          .tickSize(chartHeight) // only extend to chart height, not overall height
          .tickValues(d3.range(xDomain[0], xDomain[1], X_BOX))
          .tickFormat(() => "");
      };

      const yAxis = d3
        .axisRight(y)
        .tickSize(chartWidth)
        .ticks(numYGrids)
        .tickFormat(() => "");
      const xAxis = generateXAxis(numXGrids);

      svg
        .append("g")
        .attr("id", `ecg-x-axis`)
        .classed("x", true)
        .classed("grid", true)
        .call(xAxis)
        .attr("color", GRIDLINE_COLOR)
        .selectAll("line")
        .style("stroke-width", strokePattern);

      svg
        .append("g")
        .attr("id", `ecg-y-axis`)
        .classed("y", true)
        .classed("grid", true)
        .call(yAxis)
        .attr("color", GRIDLINE_COLOR)
        .selectAll("line")
        .style("stroke-width", strokePattern);

      const plotGroup = svg
        .selectAll(".ecgLine")
        .data(rearrangedBuffer)
        .enter()
        .append("g");

      // Plot our ECG lines
      function plotLine(leadData: number[], leadIndex: number) {
        const valueLine: any = d3
          .line()
          .x((_, i: number) => x(bufferTime[leadIndex][i]))
          .y((_, i: number) => {
            const chartLength = Math.abs(MINMV) + MAXMV;
            const chartOffset = (numLeads - leadIndex) * chartLength;
            return y(leadData[i] + chartOffset);
          });
        return valueLine(leadData);
      }

      plotGroup
        .append("path")
        .attr("fill", "none")
        .attr("stroke-width", 1)
        .attr("stroke", "black")
        .attr("d", plotLine);

      // Plot our ECG texts on the lines
      plotGroup
        .append("text")
        .attr("x", MARGINS.LEFT * 2)
        .attr(
          "y",
          (_, leadIndex) =>
            y((numLeads + 1 - leadIndex) * (Math.abs(MINMV) + MAXMV)) +
            DEFAULT_BOX_SIZE * 7
        )
        .attr("dy", ".35em")
        .attr("fill", "black")
        .text((_, leadIndex) => `Lead ${rearrangedChannels[leadIndex]}`);

      // Initialize brush
      const brush: any = d3
        .brushX()
        .extent([
          [0, 0],
          [chartWidth, chartHeight],
        ])
        .on("end", updateChart);

      // Append brush to the chart
      plotGroup.append("g").attr("id", "brush").call(brush);

      function updateChart(e: any) {
        // Update chart based on brushed extent
        if (e.selection) {
          let [x0, x1] = e.selection;
          // We now check the pixel width of the selection
          const newXDomain = [x.invert(x0), x.invert(x1)];
          const numGrids = Math.floor((newXDomain[1] - newXDomain[0]) / X_BOX);
          console.log(newXDomain, numGrids, e.selection);
          x.domain(newXDomain);

          svg
            .select<SVGGElement>("#ecg-x-axis")
            .transition()
            .duration(1000)
            .call(generateXAxis(numGrids))
            .attr("color", GRIDLINE_COLOR)
            .selectAll("line")
            .style("stroke-width", strokePattern);

          plotGroup.select("#brush").call(brush.move, null);
          plotGroup
            .select("path")
            .transition()
            .duration(1000)
            .attr("d", plotLine);
        }
      }
      // On double click, zoom out of the chart
      svg.on("dblclick", function () {
        x.domain(xDomain);
        svg
          .select<SVGGElement>("#ecg-x-axis")
          .transition()
          .duration(1000)
          .call(generateXAxis(numXGrids))
          .attr("color", GRIDLINE_COLOR)
          .selectAll("line")
          .style("stroke-width", strokePattern);

        plotGroup
          .select("path")
          .transition()
          .duration(1000)
          .attr("d", plotLine);
      });
    },
    []
  );

  return (
    <div id="ecg-chart" style={{ width: "100%", height: "100%" }}>
      <div
        style={{
          "::-webkit-scrollbar": {
            height: 10,
            width: 0,
            border: "1px solid #d5d5d5",
            background: "gray",
          },
          width: "100%",
          overflow: "scroll",
          zIndex: 10,
          height: 500,
        }}
        id="ecg-container"
      >
        <svg ref={chartRef} style={{ display: "block" }} id="ecg-chart-svg" />
      </div>
    </div>
  );
}
