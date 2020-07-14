/**
 * @license MediaSticky
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import { MessageLabel } from '../modules_common/i18n';
import { CardPropSerializable } from './cardprop';

interface WindowWithAPI extends Window {
  api: {
    alertDialog: (id: string, label: MessageLabel) => Promise<void>;
    blurAndFocusWithSuppressEvents: (id: string) => Promise<void>;
    blurAndFocusWithSuppressFocusEvents: (id: string) => Promise<void>;
    bringToFront: (id: string) => Promise<number>;
    createCard: (subsetOfCardPropSerializable: Record<string, any>) => Promise<string>;
    confirmDialog: (
      id: string,
      buttonLabels: MessageLabel[],
      label: MessageLabel
    ) => Promise<number>;
    deleteCard: (id: string) => Promise<void>;
    finishLoad: (id: string) => Promise<void>;
    finishRenderCard: (id: string) => Promise<void>;
    focus: (id: string) => Promise<void>;
    getUuid: () => Promise<string>;
    onCardBlurred: (listener: Function) => void;
    onCardClose: (listener: Function) => void;
    onCardFocused: (listener: Function) => void;
    onMoveByHand: (listener: Function) => void;
    onRenderCard: (listener: Function) => void;
    onResizeByHand: (listener: Function) => void;
    saveCard: (cardPropSerializable: CardPropSerializable) => Promise<void>;
    sendLeftMouseDOwn: (id: string, x: number, y: number) => Promise<void>;
    setWindowSize: (id: string, width: number, height: number) => Promise<void>;
    setTitle: (id: string, title: string) => Promise<void>;
  };
}
declare const window: WindowWithAPI;
export default window;
