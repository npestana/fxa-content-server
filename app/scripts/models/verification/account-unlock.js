/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/**
 * A model to hold account unlock verification data
 */

define([
  './base',
  'lib/validate'
], function (VerificationInfo, Validate) {
  'use strict';

  return VerificationInfo.extend({
    defaults: {
      code: null,
      uid: null
    },

    validation: {
      code: Validate.isCodeValid,
      uid: Validate.isUidValid
    }
  });
});

