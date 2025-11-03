declare module 'react-map-gl' {
  import { CSSProperties, ReactNode, RefObject } from 'react';

  export interface ViewState {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
  }

  export interface MapProps {
    ref?: RefObject<any>;
    mapboxAccessToken: string;
    initialViewState: ViewState;
    style?: CSSProperties;
    mapStyle?: string;
    children?: ReactNode;
  }

  export interface MarkerProps {
    longitude: number;
    latitude: number;
    children?: ReactNode;
  }

  export interface SourceProps {
    id: string;
    type: string;
    data: any;
    children?: ReactNode;
  }

  export interface LayerProps {
    id: string;
    type: string;
    paint?: Record<string, any>;
    layout?: Record<string, any>;
  }

  export default function Map(props: MapProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
  export function Source(props: SourceProps): JSX.Element;
  export function Layer(props: LayerProps): JSX.Element;
}
