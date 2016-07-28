(function () {
  'use strict';

  function __$styleInject(css) {
    css = css || '';
    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';
    if (style.styleSheet){
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
  }
  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var Modal = function () {
    function Modal(name) {
      classCallCheck(this, Modal);

      this.name = name;
    }

    createClass(Modal, [{
      key: "init",
      value: function init() {
        console.log(this.name);
      }
    }]);
    return Modal;
  }();

  __$styleInject("html, body {\n  height: 100%;\n}\n\nbody {\n  margin: 0;\n  padding: 0;\n  display: -webkit-box;\n  display: -webkit-flex;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-pack: center;\n  -webkit-justify-content: center;\n      -ms-flex-pack: center;\n          justify-content: center;\n  -webkit-box-align: center;\n  -webkit-align-items: center;\n      -ms-flex-align: center;\n          align-items: center;\n}\n\n.center {\n  text-align: center;\n}\n\n.center h2 {\n  font-size: 30px;\n}\n\n.center .desc {\n  font-size: 14px;\n  color: #999;\n}");

  function init() {
    var txt, modal;
    return Promise.resolve().then(function () {

      console.log('app');

      return red();
    }).then(function (_resp) {
      txt = _resp;

      console.log(txt);

      modal = new Modal();

      modal.init();

      window.setTimeout(function () {
        document.body.style.visibility = 'visible';
      }, 500);
    });
  }

  function red() {
    return new Promise(function (resolve, reject) {
      resolve('red');
    });
  }

  init();

}());