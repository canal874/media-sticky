/**
 * @license Media Stickies
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { SettingsDialog, SettingsDialogProps } from './modules_settings/SettingsDialog';

const onready = () => {
  const domContainer = document.getElementById('react-container');
  const props: SettingsDialogProps = {
    menu: {
      title: 'Settings',
      defaultItem: 'save',
      items: ['save', 'permission', 'language'],
    },
  };
  ReactDOM.render(React.createElement(SettingsDialog, props), domContainer);
};

window.document.addEventListener('DOMContentLoaded', onready);
