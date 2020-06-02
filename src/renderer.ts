/**
 * @license MediaSticky
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import { ipcRenderer, remote } from 'electron';
import uniqid from 'uniqid'; // electron-context-menu uses CommonJS compatible export
import contextMenu from 'electron-context-menu';
import { CardProp, CardPropSerializable } from './modules_common/cardprop';

import { CardCssStyle, ICardEditor } from './modules_common/types';
import { CardEditor } from './modules_ext/editor';
import {
  getRenderOffsetHeight,
  getRenderOffsetWidth,
  initCardRenderer,
  render,
} from './modules_renderer/card_renderer';
import { getImageTag, logger } from './modules_common/utils';
import { saveCardColor, saveData, waitUnfinishedSaveTasks } from './modules_renderer/save';

const main = remote.require('./main');
let MESSAGE: Record<string, string> = {};
ipcRenderer
  .invoke('get-messages')
  .then(res => {
    MESSAGE = res;
  })
  .catch(e => {});

let cardProp: CardProp = new CardProp('');

let cardCssStyle: CardCssStyle = {
  padding: { left: 0, right: 0, top: 0, bottom: 0 },
  border: { left: 0, right: 0, top: 0, bottom: 0 },
};

const cardEditor: ICardEditor = new CardEditor();

const close = async () => {
  await waitUnfinishedSaveTasks().catch((e: Error) => {
    logger.debug(e.message);
  });
  window.close();
};

/**
 * queueSaveCommand
 * Queuing and execute only last save command to avoid frequent save.
 */
let execSaveCommandTimeout: NodeJS.Timeout;
const execSaveCommand = () => {
  saveData(cardProp);
};

const queueSaveCommand = () => {
  clearTimeout(execSaveCommandTimeout);
  execSaveCommandTimeout = setTimeout(execSaveCommand, 1000);
};

/**
 * Context Menu
 */

contextMenu({
  window: remote.getCurrentWindow(),
  showSaveImageAs: true,
  showInspectElement: false,
  append: () => [
    {
      label: MESSAGE.yellow,
      click: () => {
        saveCardColor(cardProp, '#ffffa0');
        render(['Decoration', 'EditorColor']);
      },
    },
    {
      label: MESSAGE.red,
      click: () => {
        saveCardColor(cardProp, '#ffb0b0');
        render(['Decoration', 'EditorColor']);
      },
    },
    {
      label: MESSAGE.green,
      click: () => {
        saveCardColor(cardProp, '#d0ffd0');
        render(['Decoration', 'EditorColor']);
      },
    },
    {
      label: MESSAGE.blue,
      click: () => {
        saveCardColor(cardProp, '#d0d0ff');
        render(['Decoration', 'EditorColor']);
      },
    },
    {
      label: MESSAGE.orange,
      click: () => {
        saveCardColor(cardProp, '#ffb000');
        render(['Decoration', 'EditorColor']);
      },
    },
    {
      label: MESSAGE.purple,
      click: () => {
        saveCardColor(cardProp, '#ffd0ff');
        render(['Decoration', 'EditorColor']);
      },
    },
    {
      label: MESSAGE.white,
      click: () => {
        saveCardColor(cardProp, '#ffffff');
        render(['Decoration', 'EditorColor']);
      },
    },
    {
      label: MESSAGE.gray,
      click: () => {
        saveCardColor(cardProp, '#d0d0d0');
        render(['Decoration', 'EditorColor']);
      },
    },
    {
      label: MESSAGE.transparent,
      click: () => {
        saveCardColor(cardProp, '#ffffff', '#ffffff', 0.0);
        render(['Decoration', 'EditorColor']);
      },
    },
  ],
});

/**
 * Initialize
 */
const initializeUIEvents = () => {
  document.addEventListener('dragover', e => {
    e.preventDefault();
    return false;
  });

  document.addEventListener('drop', e => {
    e.preventDefault();

    const file = e.dataTransfer?.files[0];

    const dropImg = new Image();
    if (file) {
      dropImg.addEventListener('load', () => {
        const width = dropImg.naturalWidth;
        const height = dropImg.naturalHeight;

        let newWidth = cardProp.rect.width - 15;
        let newHeight = height;
        if (newWidth < width) {
          newHeight = (height * newWidth) / width;
        }
        else {
          newWidth = width;
        }

        const imgTag = getImageTag(uniqid(), file!.path, newWidth, newHeight);
        if (cardProp.data === '') {
          cardProp.data = imgTag;
          cardProp.rect.height = newHeight + 15;
        }
        else {
          cardProp.data = cardProp.data + '<br />' + imgTag;
          cardProp.rect.height += newHeight + 15;
        }

        main.setWindowSize(cardProp.id, cardProp.rect.width, cardProp.rect.height);
        render(['Decoration', 'ContentsData']);
        saveData(cardProp);
      });
      dropImg.src = file.path;
    }
    return false;
  });

  // eslint-disable-next-line no-unused-expressions
  document.getElementById('newBtn')?.addEventListener('click', () => {
    ipcRenderer.invoke('create-card');
  });

  // eslint-disable-next-line no-unused-expressions
  document.getElementById('contents')?.addEventListener('click', async () => {
    // 'contents' can be clicked when cardEditor.editorType is 'Markup'
    if (window.getSelection()?.toString() === '') {
      await cardEditor.showEditor().catch((e: Error) => {
        logger.error(`Error in clicking contents: ${e.message}`);
      });
      cardEditor.startEdit();
    }
  });

  // eslint-disable-next-line no-unused-expressions
  document.getElementById('codeBtn')?.addEventListener('click', () => {
    cardEditor.toggleCodeMode();
  });

  // eslint-disable-next-line no-unused-expressions
  document.getElementById('closeBtn')?.addEventListener('click', () => {
    if (cardEditor.isOpened) {
      if (cardEditor.editorType === 'Markup') {
        cardEditor.hideEditor();
      }
      const [dataChanged, data] = cardEditor.endEdit();
      cardProp.data = data;
      render(['ContentsData', 'ContentsRect']);
      if (dataChanged && cardProp.data !== '') {
        saveData(cardProp);
      }
    }
    if (cardProp.data === '') {
      ipcRenderer.invoke('delete-card', cardProp.id);
    }
    else {
      /**
       * Don't use window.confirm(MESSAGE.confirm_closing)
       * It disturbs correct behavior of CKEditor.
       * Caret of CKEditor is disappeared just after push Cancel button of window.confirm()
       */
      remote.dialog
        .showMessageBox(remote.getCurrentWindow(), {
          type: 'question',
          buttons: [MESSAGE.btnCloseCard, 'Cancel'],
          defaultId: 0,
          cancelId: 1,
          message: MESSAGE.confirmClosing,
        })
        .then(res => {
          if (res.response === 0) {
            // OK
            close();
          }
          else if (res.response === 1) {
            // Cancel
          }
        })
        .catch((e: Error) => {
          logger.debug(e.message);
        });
    }
  });
};

const onload = async () => {
  window.removeEventListener('load', onload, false);

  const url = window.location.search;
  const arr = url.slice(1).split('&');
  const params: { [key: string]: string } = {};
  for (var i = 0; i < arr.length; i++) {
    const pair = arr[i].split('=');
    params[pair[0]] = pair[1];
  }
  const id = params.id;
  if (!id) {
    alert(MESSAGE.pleaseRestartErrorInOpeningCard);
    console.error('id parameter is not given in URL');
    return;
  }

  cardCssStyle = {
    padding: {
      left: parseInt(
        window.getComputedStyle(document.getElementById('contents')!).paddingLeft,
        10
      ),
      right: parseInt(
        window.getComputedStyle(document.getElementById('contents')!).paddingRight,
        10
      ),
      top: parseInt(
        window.getComputedStyle(document.getElementById('contents')!).paddingTop,
        10
      ),
      bottom: parseInt(
        window.getComputedStyle(document.getElementById('contents')!).paddingBottom,
        10
      ),
    },
    border: {
      left: parseInt(
        window.getComputedStyle(document.getElementById('card')!).borderLeft,
        10
      ),
      right: parseInt(
        window.getComputedStyle(document.getElementById('card')!).borderRight,
        10
      ),
      top: parseInt(
        window.getComputedStyle(document.getElementById('card')!).borderTop,
        10
      ),
      bottom: parseInt(
        window.getComputedStyle(document.getElementById('card')!).borderBottom,
        10
      ),
    },
  };

  initializeUIEvents();

  await cardEditor.loadUI(cardCssStyle);
  // console.debug('(2) loadUI is completed');
  ipcRenderer.send('finish-load', id);
};

const initializeIPCEvents = () => {
  // ipc (inter-process communication)

  // Render card data
  ipcRenderer.on(
    'render-card',
    (event: Electron.IpcRendererEvent, _prop: CardPropSerializable) => {
      cardProp = CardProp.fromObject(_prop);

      initCardRenderer(cardProp, cardCssStyle, cardEditor);

      cardEditor.setCard(cardProp);

      document.getElementById('card')!.style.visibility = 'visible';

      render();

      if (cardEditor.editorType === 'WYSIWYG') {
        cardEditor.showEditor().catch((e: Error) => {
          // logger.error does not work in ipcRenderer event.
          console.error(`Error in render-card: ${e.message}`);
        });
      }
    }
  );

  ipcRenderer.on('card-close', () => {
    close();
  });

  ipcRenderer.on('card-focused', () => {
    console.debug('card-focused');

    cardProp.status = 'Focused';
    render(['Decoration']);

    if (cardEditor.editorType === 'WYSIWYG') {
      cardEditor.startEdit();
    }
  });

  ipcRenderer.on('card-blurred', () => {
    console.debug('card-blurred');

    cardProp.status = 'Blurred';
    render(['Decoration']);

    if (cardEditor.isOpened) {
      if (cardEditor.editorType === 'Markup') {
        cardEditor.hideEditor();
      }
      const [dataChanged, data] = cardEditor.endEdit();
      if (dataChanged) {
        cardProp.data = data;
        render(['ContentsData', 'ContentsRect']);
        saveData(cardProp);
      }
    }
  });

  ipcRenderer.on(
    'resize-by-hand',
    (event: Electron.IpcRendererEvent, newBounds: Electron.Rectangle) => {
      cardProp.rect.width = newBounds.width + getRenderOffsetWidth();
      cardProp.rect.height = newBounds.height + getRenderOffsetHeight();

      render(['TitleBar', 'ContentsRect', 'EditorRect']);

      queueSaveCommand();
    }
  );

  ipcRenderer.on(
    'move-by-hand',
    (event: Electron.IpcRendererEvent, newBounds: Electron.Rectangle) => {
      cardProp.rect.x = newBounds.x;
      cardProp.rect.y = newBounds.y;

      queueSaveCommand();
    }
  );
};

initializeIPCEvents();
window.addEventListener('load', onload, false);
