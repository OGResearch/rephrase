/**
 * Utility methods to fetch data from the $databank variable
 * 
 * ---
 * Copyright © 2021 OGResearch. All rights reserved.
 */

'use strict';

/**
 * fetch an object stored in $databank under the given name
 * if not found return an empty object
 */ 
function getEntry(name) {
  if ($databank && typeof $databank === "object" && $databank.hasOwnProperty(name)) {
    return $databank[name];
  }
  return {};
}

/**
 * get the value of the Name field for the specified object name
 * if not found return an empty string
 */
function getEntryName(name) {
  const dataObj = getEntry(name);
  return dataObj.Name || "";
}

/**
 * fetch the series from $databank reconstructing all the dates
 */
function getSeriesContent(name) {
  const dataObj = getEntry(name);
  if (dataObj && typeof dataObj === "object" && dataObj.hasOwnProperty("Values")
    && (dataObj.Values instanceof Array) && dataObj.hasOwnProperty("Dates")) {
    var dates = [];
    if ((dataObj.Dates instanceof Array) && dataObj.Dates.length === dataObj.Values.length) {
      dates = dataObj.Dates.map(function (d) {
        return new Date(d);
      });
    } else {
      const freqUnit = freqToMomentJsUnit(dataObj.Frequency);
      const startDate = new Date((dataObj.Dates instanceof Array) ? dataObj.Dates[0] : dataObj.Dates);
      for (var i = 0; i < dataObj.Values.length; i++) {
        dates.push(moment(startDate).add(i, freqUnit).toDate());
      }
    }
    return { Values: dataObj.Values, Dates: dates };
  }
  return {};
}

// convert frequency letter to Moment.js time unit
function freqToMomentJsUnit(freq) {
  var unit = "";
  switch (+freq) {
    case 365:
      unit = "day";
      break;
    case 52:
      unit = "week";
      break;
    case 12:
      unit = "month";
      break;
    case 4:
      unit = "quarter";
      break;
    case 1:
      unit = "year";
      break;
    default:
      unit = "";
  }
  return unit;
}