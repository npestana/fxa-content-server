/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Watch for page refreshes.
 *
 * Listen for `show-view` and `show-child-view` messages and check if the user
 * has refreshed the page. If so, a `<view_name>.refresh` event is
 * logged to metrics.
 */

define([
  'backbone',
  'lib/storage'
], function (Backbone, Storage) {
  'use strict';

  function isRefresh (refreshMetrics, viewName) {
    return refreshMetrics && refreshMetrics.view === viewName;
  }

  return Backbone.Model.extend({
    initialize: function (options) {
      options = options || {};

      this._metrics = options.metrics;
      this._notifications = options.notifications;
      this._window = options.window || window;

      this._storage = Storage.factory('sessionStorage', this._window);

      this._notifications.on('show-view', this._onShowView.bind(this));
      this._notifications.on('show-child-view', this._onShowChildView.bind(this));
    },

    _onShowView: function (View, viewOptions) {
      this.logIfRefresh(viewOptions.viewName);
    },

    _onShowChildView: function (ChildView, ParentView, viewOptions) {
      this.logIfRefresh(viewOptions.viewName);
    },

    /**
     * Log a `<view_name>.refresh` event if `viewName` matches the
     * previous view's name. Works across page reloads.
     *
     * @param {string} viewName
     */
    logIfRefresh: function (viewName) {
      var refreshMetrics = this._storage.get('last_page_loaded');

      if (isRefresh(refreshMetrics, viewName)) {
        this._metrics.logViewEvent(viewName, 'refresh');
      }

      refreshMetrics = {
        timestamp: Date.now(),
        view: viewName
      };

      this._storage.set('last_page_loaded', refreshMetrics);
    }
  });
});
