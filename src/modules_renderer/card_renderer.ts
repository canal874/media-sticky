/**
 * @license MediaSticky
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import { ipcRenderer, WebviewTag } from 'electron';
import { CardProp } from '../modules_common/cardprop';
import { CardCssStyle, ContentsFrameMessage, ICardEditor } from '../modules_common/types';
import { convertHexColorToRgba, darkenHexColor } from '../modules_common/utils';
import { Messages } from '../modules_common/i18n';

export const UI_COLOR_DARKENING_RATE = 0.8;

let cardCssStyle: CardCssStyle;
let cardProp: CardProp;
let cardEditor: ICardEditor;

let renderOffsetHeight = 0; // Offset of card height from actual window height;
let renderOffsetWidth = 0; // Offset of card height from actual window width;

// eslint-disable-next-line import/no-mutable-exports
export let MESSAGE: Messages;
ipcRenderer
  .invoke('get-messages')
  .then(res => {
    MESSAGE = res;
  })
  .catch(e => {});

export const getRenderOffsetWidth = () => {
  return renderOffsetWidth;
};
export const setRenderOffsetWidth = (w: number) => {
  renderOffsetWidth = w;
};
export const getRenderOffsetHeight = () => {
  return renderOffsetHeight;
};
export const setRenderOffsetHeight = (h: number) => {
  renderOffsetHeight = h;
};

export const initCardRenderer = (
  prop: CardProp,
  style: CardCssStyle,
  editor: ICardEditor
) => {
  cardProp = prop;
  cardCssStyle = style;
  cardEditor = editor;
};

export type CardRenderOptions =
  | 'TitleBar'
  | 'CardStyle'
  | 'ContentsData'
  | 'ContentsRect'
  | 'EditorStyle'
  | 'EditorRect';

const setWindowTitle = () => {
  const title = cardProp.data === '' ? MESSAGE.newCard : cardProp.data;
  ipcRenderer.invoke('set-title', cardProp.id, CardProp.getPlainText(title));
};

const renderTitleBar = () => {
  const closeBtnLeft =
    cardProp.geometry.width -
    cardCssStyle.border.left -
    cardCssStyle.border.right -
    document.getElementById('closeBtn')!.offsetWidth;
  document.getElementById('closeBtn')!.style.left = closeBtnLeft + 'px';
  const titleBarLeft =
    document.getElementById('codeBtn')!.offsetLeft +
    document.getElementById('codeBtn')!.offsetWidth;
  const barwidth = closeBtnLeft - titleBarLeft;
  document.getElementById('titleBar')!.style.left = titleBarLeft + 'px';
  document.getElementById('titleBar')!.style.width = barwidth + 'px';
  setWindowTitle();
};

const renderContentsData = () => {
  // Script and CSS loaded from contents_frame.html are remained after document.write().
  const html = `<!DOCTYPE html>
  <html>
    <head>
      <link href='../css/ckeditor-media-stickies-contents.css' type='text/css' rel='stylesheet' />
      <script> var exports = {}; </script>
      <script type='text/javascript' src='contents_frame.js'></script>
    </head>
    <body>
      ${cardProp.data}
    </body>
  </html>`;

  const msg: ContentsFrameMessage = {
    command: 'overwrite-iframe',
    arg: html,
  };
  const webview = document.getElementById('contentsFrame')! as WebviewTag;
  /*
  if (!webview.isDevToolsOpened()) {
    webview.openDevTools();
  }
  */
  webview.send('message', msg);
};

const renderContentsRect = () => {
  // width of BrowserWindow (namely cardProp.geometry.width) equals border + padding + content.
  document.getElementById('contents')!.style.width =
    cardProp.geometry.width -
    cardCssStyle.border.left -
    cardCssStyle.border.right -
    cardCssStyle.padding.left -
    cardCssStyle.padding.right +
    'px';

  document.getElementById('contents')!.style.height =
    cardProp.geometry.height -
    cardCssStyle.border.top -
    cardCssStyle.border.bottom -
    document.getElementById('titleBar')!.offsetHeight -
    cardCssStyle.padding.top -
    cardCssStyle.padding.bottom +
    'px';
};

const renderCardStyle = () => {
  if (cardProp.status === 'Focused') {
    document.getElementById('card')!.style.border = '3px solid red';
  }
  else if (cardProp.status === 'Blurred') {
    document.getElementById('card')!.style.border = '3px solid transparent';
  }

  document.getElementById('title')!.style.visibility = 'visible';
  if (cardProp.style.opacity === 0 && cardProp.status === 'Blurred') {
    document.getElementById('title')!.style.visibility = 'hidden';
  }

  // Set card properties
  const backgroundRgba = convertHexColorToRgba(
    cardProp.style.backgroundColor,
    cardProp.style.opacity
  );
  // document.getElementById('contents')!.style.backgroundColor = backgroundRgba;
  const darkerRgba = convertHexColorToRgba(
    darkenHexColor(cardProp.style.backgroundColor, 0.95),
    cardProp.style.opacity
  );
  document.getElementById(
    'contents'
  )!.style.background = `linear-gradient(135deg, ${backgroundRgba} 94%, ${darkerRgba})`;

  const uiRgba = convertHexColorToRgba(cardProp.style.uiColor);

  [...document.getElementsByClassName('title-color')].forEach(node => {
    (node as HTMLElement).style.backgroundColor = uiRgba;
  });

  /* TODO:
  const doc = (document.getElementById('contentsFrame')! as HTMLIFrameElement)
    .contentWindow!.document;
  if (doc) {
    const style = doc.createElement('style');
    style.innerHTML =
      'body::-webkit-scrollbar { width: 7px; background-color: ' +
      backgroundRgba +
      '}\n' +
      'body::-webkit-scrollbar-thumb { background-color: ' +
      uiRgba +
      '}';
    doc
      .getElementsByTagName('head')
      .item(0)!
      .appendChild(style);
  }

  (document.getElementById(
    'contentsFrame'
  )! as HTMLIFrameElement).contentWindow!.document.body.style.zoom = `${cardProp.style.zoom}`;
  */
};

const renderEditorStyle = () => {
  cardEditor.setColor();
  cardEditor.setZoom();
};

const renderEditorRect = () => {
  cardEditor.setSize();
};

export const setTitleMessage = (msg: string) => {
  if (document.getElementById('titleMessage')) {
    document.getElementById('titleMessage')!.innerHTML = msg;
  }
};

export const render = (
  options: CardRenderOptions[] = [
    'TitleBar',
    'ContentsData',
    'ContentsRect',
    'CardStyle',
    'EditorStyle',
    'EditorRect',
  ]
) => {
  for (const opt of options) {
    if (opt === 'TitleBar') renderTitleBar();
    else if (opt === 'ContentsData') renderContentsData();
    else if (opt === 'ContentsRect') renderContentsRect();
    else if (opt === 'CardStyle') renderCardStyle();
    else if (opt === 'EditorStyle') renderEditorStyle();
    else if (opt === 'EditorRect') renderEditorRect();
  }
};
