import "file-loader?name=[name].[ext]!./index.html";
import "file-loader?name=[name].[ext]!../node_modules/qunit/qunit/qunit.css";
import { module, test, config, dump } from "qunit";
import { parse } from "hbs-parser-next";

config.autostart = true;
config.urlConfig.push({
  id: "logging",
  label: "Enable logging"
});
dump.maxDepth = 25;

import "./combinators-test";
import "./multi-test";
import "./reader/interpolation";
import "./reader/html";
