/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'chai',
  'jquery',
  'sinon',
  'views/sign_up',
  'lib/promise',
  'lib/session',
  'lib/fxa-client',
  'lib/metrics',
  'lib/oauth-client',
  'lib/assertion',
  'lib/able',
  'models/reliers/oauth',
  'models/auth_brokers/oauth',
  'models/user',
  'models/form-prefill',
  'models/notifications',
  '../../mocks/window',
  '../../mocks/router',
  '../../lib/helpers'
],
function (chai, $, sinon, View, p, Session, FxaClient, Metrics, OAuthClient,
      Assertion, Able, OAuthRelier, OAuthBroker, User, FormPrefill, Notifications, WindowMock,
      RouterMock, TestHelpers) {
  'use strict';

  var assert = chai.assert;

  function fillOutSignUp (email, password, opts) {
    opts = opts || {};
    var context = opts.context || window;
    var year = opts.year || '24';

    context.$('[type=email]').val(email);
    context.$('[type=password]').val(password);

    if (! opts.ignoreYear) {
      $('#age').val(year);
    }

    if (context.enableSubmitIfValid) {
      context.enableSubmitIfValid();
    }
  }

  var CLIENT_ID = 'dcdb5ae7add825d2';
  var STATE = '123';
  var SCOPE = 'profile:email';
  var CLIENT_NAME = '123Done';
  var BASE_REDIRECT_URL = 'http://127.0.0.1:8080/api/oauth';

  describe('views/sign_up for /oauth/signup', function () {
    var view;
    var router;
    var email;
    var metrics;
    var windowMock;
    var fxaClient;
    var oAuthClient;
    var assertionLibrary;
    var relier;
    var broker;
    var user;
    var formPrefill;
    var able;
    var notifications;

    beforeEach(function () {
      Session.clear();
      email = TestHelpers.createEmail();

      router = new RouterMock();

      windowMock = new WindowMock();
      metrics = new Metrics();
      relier = new OAuthRelier({
        window: windowMock
      });
      relier.set({
        clientId: CLIENT_ID,
        redirectUri: BASE_REDIRECT_URL,
        scope: SCOPE,
        serviceName: CLIENT_NAME,
        state: STATE
      });
      broker = new OAuthBroker({
        relier: relier,
        session: Session,
        window: windowMock
      });

      oAuthClient = new OAuthClient();
      sinon.stub(oAuthClient, 'getClientInfo', function () {
        return p({
          name: '123Done',
          redirect_uri: BASE_REDIRECT_URL //eslint-disable-line camelcase
        });
      });

      fxaClient = new FxaClient();
      assertionLibrary = new Assertion({
        fxaClient: fxaClient
      });
      user = new User({
        fxaClient: fxaClient
      });
      formPrefill = new FormPrefill();
      able = new Able();
      notifications = new Notifications();

      view = new View({
        able: able,
        assertionLibrary: assertionLibrary,
        broker: broker,
        formPrefill: formPrefill,
        fxaClient: fxaClient,
        metrics: metrics,
        notifications: notifications,
        oAuthClient: oAuthClient,
        relier: relier,
        router: router,
        user: user,
        viewName: 'oauth.signup',
        window: windowMock
      });

      return view.render()
          .then(function () {
            $('#container').html(view.el);
          });
    });

    afterEach(function () {
      Session.clear();
      view.remove();
      view.destroy();
    });

    describe('render', function () {
      it('displays oAuth client name', function () {
        return view.render()
          .then(function () {
            assert.include($('#fxa-signup-header').text(), CLIENT_NAME);
            // also make sure link is correct
            assert.equal($('.sign-in').attr('href'), '/oauth/signin');
          });
      });
    });

    describe('submit without a preVerifyToken', function () {
      it('redirects to confirm on success', function () {
        fillOutSignUp(email, 'password', { context: view });

        sinon.stub(user, 'signUpAccount', function (account) {
          return p(account);
        });

        sinon.stub(relier, 'accountNeedsPermissions', function () {
          return false;
        });

        return view.submit()
          .then(function () {
            assert.equal(user.signUpAccount.args[0][0].get('email'), email);
            assert.equal(user.signUpAccount.args[0][0].get('password'), 'password');
            assert.equal(router.page, 'confirm');
            assert.isTrue(TestHelpers.isEventLogged(metrics,
                              'oauth.signup.success'));
          });
      });
    });

    describe('submit with a preVerifyToken', function () {
      beforeEach(function () {
        relier.set('preVerifyToken', 'preverifytoken');
      });

      it('notifies the broker when a pre-verified user signs up', function () {
        sinon.stub(user, 'signUpAccount', function (account) {
          account.set('sessionToken', 'asessiontoken');
          account.set('verified', true);
          return p(account);
        });

        sinon.stub(broker, 'afterSignIn', function () {
          return p();
        });
        sinon.stub(relier, 'accountNeedsPermissions', function () {
          return false;
        });

        fillOutSignUp(email, 'password', { context: view });

        return view.submit()
          .then(function () {
            assert.isTrue(broker.afterSignIn.called);
            assert.equal(broker.afterSignIn.args[0][0].get('email'), email);
            assert.isTrue(TestHelpers.isEventLogged(metrics,
                              'oauth.signup.preverified'));
            assert.isTrue(TestHelpers.isEventLogged(metrics,
                              'oauth.signup.preverified.success'));
            assert.isTrue(TestHelpers.isEventLogged(metrics,
                              'oauth.signup.success'));
          });
      });

      it('redirects to /confirm if pre-verification is not successful', function () {
        sinon.stub(user, 'signUpAccount', function (account) {
          account.set('sessionToken', 'asessiontoken');
          account.set('verified', false);
          return p(account);
        });
        sinon.stub(relier, 'accountNeedsPermissions', function () {
          return false;
        });

        var password = 'password';
        fillOutSignUp(email, password, { context: view });
        return view.submit()
          .then(function () {
            assert.equal(router.page, 'confirm');
            assert.equal(user.signUpAccount.args[0][0].get('email'), email);
            assert.equal(user.signUpAccount.args[0][0].get('password'), password);
          });
      });
    });
  });
});
