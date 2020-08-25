/**
 * @license Media Stickies
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import url from 'url';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import contextMenu from 'electron-context-menu';
import {
  AvatarProp,
  AvatarPropSerializable,
  CardProp,
  CardPropSerializable,
  getAvatarLocation,
  getIdFromUrl,
  TransformableFeature,
} from '../modules_common/cardprop';
import { CardIO } from './io';
import { sleep } from '../modules_common/utils';
import { CardInitializeType } from '../modules_common/types';
import { getSettings, globalDispatch, MESSAGE } from './store';
import { cardColors, ColorName } from '../modules_common/color';
import { DialogButton } from '../modules_common/const';
import {
  getCurrentWorkspace,
  getCurrentWorkspaceId,
  getCurrentWorkspaceUrl,
  workspaces,
} from './workspace';

/**
 * Const
 */
const MINIMUM_WINDOW_WIDTH = 180;
const MINIMUM_WINDOW_HEIGHT = 80;

/**
 * Focus control
 */
let globalFocusListenerPermission = true;
/**
 * Set permission to call focus event listener in all renderer processes.
 */
export const setGlobalFocusEventListenerPermission = (
  canExecuteFocusEventListener: boolean
) => {
  globalFocusListenerPermission = canExecuteFocusEventListener;
};

export const getGlobalFocusEventListenerPermission = () => {
  return globalFocusListenerPermission;
};

/**
 * Card
 * Content unit is called 'card'.
 * A card is internally stored as an actual card (a.k.a Card class),
 * and externally represented as one or multiple avatar cards (a.k.a. Avatar class).
 */
export const cards: Map<string, Card> = new Map<string, Card>();
export const avatars: Map<string, Avatar> = new Map<string, Avatar>();

export const getCardFromUrl = (_url: string): Card | undefined => {
  const id = getIdFromUrl(_url);
  const card = cards.get(id);
  return card;
};

const generateNewCardId = (): string => {
  return uuidv4();
};

export const getCardData = (avatarUrl: string) => {
  return getCardFromUrl(avatarUrl)?.prop.data;
};

export const getAvatarProp = (avatarUrl: string) => {
  return getCardFromUrl(avatarUrl)?.prop.avatars[getAvatarLocation(avatarUrl)];
};

export const createCard = async (propObject: CardPropSerializable) => {
  const prop = CardProp.fromObject(propObject);
  const card = new Card('New', prop);
  cards.set(card.prop.id, card);

  /**
   * Render avatar if current workspace matches
   */
  const workspaceUrl = getCurrentWorkspaceUrl();
  const promises = [];
  for (const loc in card.prop.avatars) {
    if (loc.match(workspaceUrl)) {
      const avatarUrl = loc + card.prop.id;
      const avatar = new Avatar(
        new AvatarProp(avatarUrl, getCardData(avatarUrl), getAvatarProp(avatarUrl))
      );
      avatars.set(avatarUrl, avatar);
      promises.push(avatar.render());
      getCurrentWorkspace()!.avatars.push(avatarUrl);
      promises.push(CardIO.addAvatarUrl(getCurrentWorkspaceId(), avatarUrl));
    }
  }
  await Promise.all(promises).catch(e => {
    console.error(`Error in createCard: ${e.message}`);
  });
  await saveCard(card.prop);
  return prop.id;
};

const deleteCardWithRetry = async (id: string) => {
  for (let i = 0; i < 5; i++) {
    let doRetry = false;
    // eslint-disable-next-line no-await-in-loop
    await deleteCard(id).catch(e => {
      console.error(e);
      doRetry = true;
    });
    if (!doRetry) {
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(1000);
    console.debug('retrying delete card ...');
  }
};

export const deleteCard = async (id: string) => {
  const card = cards.get(id);
  if (!card) {
    console.error(`Error in deleteCard: card does not exist: ${id}`);
    return;
  }
  /**
   * Delete all avatar cards
   */
  for (const key in card.prop.avatars) {
    const avatar = avatars.get(key);
    if (avatar) {
      avatars.delete(key);
      avatar.window.destroy();
    }
  }
  /**
   * Delete actual card
   */
  await CardIO.deleteCardData(id)
    .catch((e: Error) => {
      throw new Error(`Error in delete-card: ${e.message}`);
    })
    .then(() => {
      console.debug(`deleted : ${id}`);
      // eslint-disable-next-line no-unused-expressions
      cards.delete(id);
    })
    .catch((e: Error) => {
      throw new Error(`Error in destroy window: ${e.message}`);
    });
};

export const deleteAvatar = async (_url: string) => {
  const avatar = avatars.get(_url);
  if (avatar) {
    avatars.delete(_url);
    avatar.window.destroy();
    await CardIO.deleteAvatarUrl(getCurrentWorkspaceId(), _url);
    const ws = getCurrentWorkspace();
    if (ws) {
      ws.avatars = ws.avatars.filter(avatarUrl => avatarUrl !== _url);
    }
  }
  const card = getCardFromUrl(_url);
  if (!card) {
    return;
  }
  delete card.prop.avatars[getAvatarLocation(_url)];
  await saveCard(card.prop);
};

export const updateAvatar = async (avatarPropObj: AvatarPropSerializable) => {
  const prop = AvatarProp.fromObject(avatarPropObj);
  const card = getCardFromUrl(prop.url);
  if (!card) {
    throw new Error('The card is not registered in cards: ' + prop.url);
  }
  const feature: TransformableFeature = {
    geometry: prop.geometry,
    style: prop.style,
    condition: prop.condition,
    date: prop.date,
  };
  card.prop.data = prop.data;
  card.prop.avatars[getAvatarLocation(prop.url)] = feature;

  await saveCard(card.prop);
};

const saveCard = async (cardProp: CardProp) => {
  await CardIO.updateOrCreateCardData(cardProp).catch((e: Error) => {
    console.error(e.message);
  });
};

/**
 * Context Menu
 */
const setContextMenu = (prop: AvatarProp, win: BrowserWindow) => {
  const setColor = (name: ColorName) => {
    return {
      label: MESSAGE(name),
      click: () => {
        if (name === 'transparent') {
          win.webContents.send('change-card-color', cardColors[name], 0.0);
        }
        else {
          win.webContents.send('change-card-color', cardColors[name]);
        }
      },
    };
  };

  const dispose = contextMenu({
    window: win,
    showSaveImageAs: true,
    showInspectElement: false,
    menu: actions => [
      actions.searchWithGoogle({}),
      actions.separator(),
      actions.cut({}),
      actions.copy({}),
      actions.paste({}),
      actions.separator(),
      actions.saveImageAs({}),
      actions.separator(),
      actions.copyLink({}),
      actions.separator(),
    ],
    prepend: () => [
      {
        label: MESSAGE('zoomIn'),
        click: () => {
          win.webContents.send('zoom-in');
        },
      },
      {
        label: MESSAGE('zoomOut'),
        click: () => {
          win.webContents.send('zoom-out');
        },
      },
      {
        label: MESSAGE('sendToBack'),
        click: () => {
          win.webContents.send('send-to-back');
        },
      },
      {
        label: prop.condition.locked ? MESSAGE('unlockCard') : MESSAGE('lockCard'),
        click: () => {
          prop.condition.locked = !prop.condition.locked;
          win.webContents.send('set-lock', prop.condition.locked);
          resetContextMenu();
        },
      },
    ],
    append: () => [
      setColor('yellow'),
      setColor('red'),
      setColor('green'),
      setColor('blue'),
      setColor('orange'),
      setColor('purple'),
      setColor('white'),
      setColor('gray'),
      setColor('transparent'),
    ],
  });

  const resetContextMenu = () => {
    // @ts-ignore
    dispose();
    setContextMenu(prop, win);
  };
};

export class Card {
  public prop!: CardProp;
  public loadOrCreateCardData: () => Promise<void>;
  /**
   * constructor
   * @param cardInitializeType New or Load
   * @param arg CardProp or id
   */
  constructor (public cardInitializeType: CardInitializeType, arg?: CardProp | string) {
    if (cardInitializeType === 'New') {
      this.loadOrCreateCardData = () => {
        return Promise.resolve();
      };
      if (arg === undefined) {
        // Create card with default properties
        this.prop = new CardProp(generateNewCardId());
      }
      else if (arg instanceof CardProp) {
        // Create card with specified CardProp
        if (arg.id === '') {
          arg.id = generateNewCardId();
        }
        this.prop = arg;
      }
      else {
        throw new TypeError('Second parameter must be CardProp when creating new card.');
      }
    }
    else {
      // cardInitializeType === 'Load'
      // Load Card
      if (typeof arg !== 'string') {
        throw new TypeError('Second parameter must be id string when loading the card.');
      }
      const id = arg;

      this.loadOrCreateCardData = async () => {
        this.prop = await CardIO.getCardData(id).catch(e => {
          throw e;
        });
      };
    }
  }
}

export class Avatar {
  public prop: AvatarProp;
  public window: BrowserWindow;
  public indexUrl: string;

  public suppressFocusEventOnce = false;
  public suppressBlurEventOnce = false;
  public recaptureGlobalFocusEventAfterLocalFocusEvent = false;

  public renderingCompleted = false;

  constructor (_prop: AvatarProp) {
    this.prop = _prop;
    this.indexUrl = url.format({
      pathname: path.join(__dirname, '../index.html'),
      protocol: 'file:',
      slashes: true,
      query: {
        avatarUrl: this.prop.url,
      },
    });

    this.window = new BrowserWindow({
      webPreferences: {
        preload: path.join(__dirname, './preload.js'),
        sandbox: true,
        contextIsolation: true,
      },
      minWidth: MINIMUM_WINDOW_WIDTH,
      minHeight: MINIMUM_WINDOW_HEIGHT,

      transparent: true,
      frame: false,
      show: false,

      maximizable: false,
      fullscreenable: false,

      icon: path.join(__dirname, '../assets/media_stickies_grad_icon.ico'),
    });
    this.window.setMaxListeners(20);

    // this.window.webContents.openDevTools();

    // Resized by hand
    // will-resize is only emitted when the window is being resized manually.
    // Resizing the window with setBounds/setSize will not emit this event.
    this.window.on('will-resize', (event, newBounds) => {
      this.window.webContents.send('resize-by-hand', newBounds);
    });

    // Moved by hand
    this.window.on('will-move', (event, newBounds) => {
      this.window.webContents.send('move-by-hand', newBounds);
    });

    this.window.on('closed', () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      avatars.delete(this.prop.url);
    });

    // Open hyperlink on external browser window
    // by preventing to open it on new electron window
    // when target='_blank' is set.
    this.window.webContents.on('new-window', (e, _url) => {
      e.preventDefault();
      shell.openExternal(_url);
    });

    this.window.on('focus', this._focusListener);
    this.window.on('blur', this._blurListener);

    setContextMenu(this.prop, this.window);

    this.window.webContents.on('did-finish-load', () => {
      const checkNavigation = (_event: Electron.Event, navUrl: string) => {
        //        console.debug('did-start-navigate : ' + navUrl);
        // Check top frame
        const topFrameURL = this.indexUrl.replace(/\\/g, '/');
        if (navUrl === topFrameURL) {
          // Top frame is reloaded
          this.window.webContents.off('did-start-navigation', checkNavigation);
          console.debug('Top frame is reloaded.');
          return true;
        }

        // Check iframe
        const iframeRex = new RegExp(
          topFrameURL.replace(/index.html\?.+$/, 'iframe/contents_frame.html$')
        );
        const isValid = iframeRex.test(navUrl);
        if (navUrl === 'about:blank') {
          // skip
        }
        else if (isValid) {
          // console.debug(`Block navigation to valid url: ${url}`);
          // When iframe is reloaded, cardWindow must be also reloaded not to apply tampered sandbox attributes to iframe.
          console.error(`Block navigation to valid url: ${navUrl}`);
          this.window.webContents.off('did-start-navigation', checkNavigation);

          // Same origin policy between top frame and iframe is failed after reload(). (Cause unknown)
          // Create and destroy card for workaround.
          // this.window.webContents.send('reload');
          const avatar = new Avatar(this.prop);
          const prevWin = this.window;
          avatars.get(this.prop.url);
          avatar
            .render()
            .then(() => {
              prevWin.destroy();
              avatars.set(this.prop.url, avatar);
            })
            .catch(() => {});
        }
        else {
          console.error(`Block navigation to invalid url: ${navUrl}`);
          this.window.webContents.off('did-start-navigation', checkNavigation);
          /**
           * 1. Call window.api.finishRenderCard(cardProp.id) to tell initialize process the error
           * 2. Show alert dialog
           * 3. Remove malicious card
           */
          this.renderingCompleted = true;

          let domainMatch = navUrl.match(/https?:\/\/([^/]+?)\//);
          if (!domainMatch) {
            domainMatch = navUrl.match(/https?:\/\/([^/]+?)$/);
          }

          if (!domainMatch) {
            // not http, https

            // Don't use BrowserWindow option because it invokes focus event on the indicated BrowserWindow
            // (and the focus event causes saving data.)
            dialog.showMessageBoxSync({
              type: 'question',
              buttons: ['OK'],
              message: MESSAGE('securityLocalNavigationError', navUrl),
            });
            // Destroy
            const id = getIdFromUrl(this.prop.url);
            deleteCardWithRetry(id);
            return;
          }

          const domain = domainMatch[1];
          if (getSettings().persistent.navigationAllowedURLs.includes(domain)) {
            console.debug(`Navigation to ${navUrl} is allowed.`);
            return;
          }
          // Don't use BrowserWindow option because it invokes focus event on the indicated BrowserWindow
          // (and the focus event causes saving data.)
          const res = dialog.showMessageBoxSync({
            type: 'question',
            buttons: [MESSAGE('btnAllow'), MESSAGE('btnCancel')],
            defaultId: DialogButton.Default,
            cancelId: DialogButton.Cancel,
            message: MESSAGE('securityPageNavigationAlert', navUrl),
          });
          if (res === DialogButton.Default) {
            // Reload if permitted
            console.debug(`Allow ${domain}`);
            globalDispatch({
              type: 'navigationAllowedURLs-put',
              payload: domain,
            });
            this.window.webContents.reload();
          }
          else if (res === DialogButton.Cancel) {
            // Destroy if not permitted
            console.debug(`Deny ${domain}`);
            const id = getIdFromUrl(this.prop.url);
            deleteCardWithRetry(id);
          }
        }
      };
      //      console.debug('did-finish-load: ' + this.window.webContents.getURL());
      this.window.webContents.on('did-start-navigation', checkNavigation);
    });

    this.window.webContents.on('will-navigate', (event, navUrl) => {
      // block page transition
      const prevUrl = this.indexUrl.replace(/\\/g, '/');
      if (navUrl === prevUrl) {
        // console.debug('reload() in top frame is permitted');
      }
      else {
        console.error('Page navigation in top frame is not permitted.');
        event.preventDefault();
      }
    });
  }

  public render = async () => {
    await this._loadHTML().catch(e => {
      throw new Error(`Error in render(): ${e.message}`);
    });
    await this._renderCard(this.prop).catch(e => {
      throw new Error(`Error in _renderCard(): ${e.message}`);
    });
  };

  _renderCard = (_prop: AvatarProp) => {
    return new Promise(resolve => {
      this.window.setSize(_prop.geometry.width, _prop.geometry.height);
      this.window.setPosition(_prop.geometry.x, _prop.geometry.y);
      console.debug(`renderCard in main [${_prop.url}] ${_prop.data.substr(0, 40)}`);
      this.window.showInactive();
      this.window.webContents.send('render-card', _prop.toObject()); // CardProp must be serialize because passing non-JavaScript objects to IPC methods is deprecated and will throw an exception beginning with Electron 9.
      const checkTimer = setInterval(() => {
        if (this.renderingCompleted) {
          clearInterval(checkTimer);
          resolve();
        }
      }, 200);
    });
  };

  private _loadHTML: () => Promise<void> = () => {
    return new Promise((resolve, reject) => {
      const finishLoadListener = (event: Electron.IpcMainInvokeEvent) => {
        console.debug('loadHTML  ' + this.prop.url);
        const _finishReloadListener = () => {
          console.debug('Reloaded: ' + this.prop.url);
          this.window.webContents.send('render-card', this.prop.toObject());
        };

        // Don't use 'did-finish-load' event.
        // loadHTML resolves after loading HTML and processing required script are finished.
        //     this.window.webContents.on('did-finish-load', () => {
        ipcMain.handle(
          'finish-load-' + encodeURIComponent(this.prop.url),
          _finishReloadListener
        );
        resolve();
      };
      ipcMain.handleOnce(
        'finish-load-' + encodeURIComponent(this.prop.url),
        finishLoadListener
      );

      this.window.webContents.on(
        'did-fail-load',
        (event, errorCode, errorDescription, validatedURL) => {
          reject(new Error(`Error in loadHTML: ${validatedURL} ${errorDescription}`));
        }
      );

      this.window.loadURL(this.indexUrl);
    });
  };

  // @ts-ignore
  private _focusListener = e => {
    if (this.recaptureGlobalFocusEventAfterLocalFocusEvent) {
      this.recaptureGlobalFocusEventAfterLocalFocusEvent = false;
      setGlobalFocusEventListenerPermission(true);
    }
    if (this.suppressFocusEventOnce) {
      console.debug(`skip focus event listener ${this.prop.url}`);
      this.suppressFocusEventOnce = false;
    }
    else if (!getGlobalFocusEventListenerPermission()) {
      console.debug(`focus event listener is suppressed ${this.prop.url}`);
    }
    else {
      console.debug(`focus ${this.prop.url}`);
      this.window.webContents.send('card-focused');
    }
  };

  private _blurListener = () => {
    if (this.suppressBlurEventOnce) {
      console.debug(`skip blur event listener ${this.prop.url}`);
      this.suppressBlurEventOnce = false;
    }
    else {
      console.debug(`blur ${this.prop.url}`);
      this.window.webContents.send('card-blurred');
    }
  };
}
