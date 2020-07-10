/**
 * @license MediaSticky
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import { CardProp } from './cardprop';

export interface ICardIO {
  getCardIdList(): Promise<string[]>;
  readCardData(id: string): Promise<CardProp>;
  writeOrCreateCardData(prop: CardProp): Promise<string>;
  deleteCardData(id: string): Promise<string>;
}

export interface ICardEditor {
  readonly editorType: EditorType;
  readonly hasCodeMode: boolean;
  isCodeMode: boolean;
  isOpened: boolean;

  getImageTag(id: string, src: string, width: number, height: number, alt: string): string;

  loadUI(cardCssStyle: CardCssStyle): Promise<void>; // A Promise resolves when required initialization is finished.
  setCard(prop: CardProp): void; // Loading a card after loadUI().

  showEditor(): Promise<void>;
  hideEditor(): void;

  startEdit(): Promise<void>;
  endEdit(): { dataChanged: boolean; data: string };
  toggleCodeMode(): void;
  startCodeMode(): void;
  endCodeMode(): void;

  getScrollPosition(): { left: number; top: number };
  setScrollPosition(height: number, top: number): void;
  setZoom(): void;
  setSize(width?: number, height?: number): void;
  setColor(): void;

  execAfterMouseDown(func: Function): void;
}

export type CardCssStyle = {
  padding: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  border: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
};

export type EditorType = 'WYSIWYG' | 'Markup';

/*
export type ContentsFrameCommand =
  | 'overwrite-iframe'
  | 'click-parent'
  | 'contents-frame-loaded'
  | 'contents-frame-file-dropped';
*/
// Use iterable union instead of normal union type
// because ContentsFrameCommand is also used for runtime type check.
export const contentsFrameCommand = [
  'click-parent',
  'contents-frame-file-dropped',
  'check-initializing',
  'contents-frame-initialized',
];
// ContentsFrameCommand is union. e.g) 'overwrite-iframe' | 'click-parent' | ...
// Use ContentsFrameCommand to check type.
// Use below to iterate ContentsFrameCommands:
//   for (const cmd of contentsFrameCommand) { ... }
type ContentsFrameCommand = typeof contentsFrameCommand[number];

export type InnerClickEvent = {
  x: number;
  y: number;
};

export type FileDropEvent = {
  name: string;
  path: string;
};

export type ContentsFrameMessage = {
  command: ContentsFrameCommand;
  arg: any;
};
