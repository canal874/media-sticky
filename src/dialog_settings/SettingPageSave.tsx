/**
 * @license Media Stickies
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */
import * as React from 'react';
import { dialog, ipcRenderer } from 'electron';
import { GlobalContext, GlobalProvider } from './StoreProvider';
import './SettingPageSave.css';
import { MenuItemProps } from './MenuItem';
import { SettingPageTemplate } from './SettingPageTemplate';
import { MessageLabel } from '../modules_common/i18n';

export interface SettingPageSaveProps {
  item: MenuItemProps;
  index: number;
}

export const SettingPageSave = (props: SettingPageSaveProps) => {
  const [globalState] = React.useContext(GlobalContext) as GlobalProvider;
  const MESSAGE = (label: MessageLabel) => {
    return globalState.i18n.messages[label];
  };
  const onChangeButtonClick = async () => {
    const file = await ipcRenderer.invoke('open-directory-selector-dialog');
    console.debug(file);
  };
  return (
    <SettingPageTemplate item={props.item} index={props.index}>
      <p>{MESSAGE('saveDetailedText')}</p>
      <input type='radio' styleName='locationSelector' checked />
      <div styleName='saveFilePath'>
        {MESSAGE('saveFilePath')}: {globalState.cardDir}
      </div>
      <button styleName='saveChangeFilePathButton' onClick={onChangeButtonClick}>
        {MESSAGE('saveChangeFilePathButton')}
      </button>
    </SettingPageTemplate>
  );
};
