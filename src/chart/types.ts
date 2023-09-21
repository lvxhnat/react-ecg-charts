import { ChannelDataDTO } from 'dtos/general';

export interface ECGChartProps {
    data: ChannelDataDTO | undefined;
}

export interface ECGToolbarProps {
    handleZoomIn: (zoomFactor: string) => void
    handleZoomOut: (zoomFactor: string) => void
}