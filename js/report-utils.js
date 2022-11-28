
'use strict';

// utility methods
var $ru = {
    createChart: createChart,
    createChartContent: createChartContent,
    createChartSeries: createChartSeries,
    createChartCurve: createChartCurve,
    createChartBody: createChartBody,
    createSeries: createSeries,
    createSpreads: createSpreads,
    createTable: createTable,
    createTableSeries: createTableSeries,
    createGrid: createGrid,
    createPager: createPager,
    createMatrix: createMatrix,
    addReportElement: addReportElement,
    addPageBreak: addPageBreak,
    createWrapper: createWrapper,
    createTextBlock: createTextBlock,
    createSection: createSection,
    appendObjSettings: appendObjSettings,
    momentJsDateFormatToD3TimeFormat: momentJsDateFormatToD3TimeFormat,
    postProcessIrisCode: postProcessIrisCode,
    getElementIds: getElementIds,
    generateToc: generateToc,
    test: {
        nonemptyArray: x => x instanceof Array && x.length > 0,
    },
    printRgba: printRgba,
    whitenRgba: whitenRgba,
    colorScheme: {
        getColorList: getColorList,
    },
    table: {
        createDifftableSeriesRow: createDifftableSeriesRow,
        evalConditionals: evalConditionals,
        getTableNumberClass: getTableNumberClass,
    },
    databank: {
        getEntry: getEntry,
        getEntryName: getEntryName,
        getSeriesContent: getSeriesContent,

    },
    getTitle: getTitle,
    addUserClass: addUserClass,
    printTableValue: printTableValue,
    formatNumericValue: formatNumericValue,
};

const DEFAULT_MARKER_COLOR = [10, 10, 10, 1];
const DEFAULT_HIGHLIGHT_FILLCOLOR = [100, 100, 100, 0.2];
const DEFAULT_SHOW_LEGEND = true;
const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_NUM_DECIMALS = 2;
const DEFAULT_HOVERFORMAT = ".2r"; // Round y-axis data tips to 2 significant numbers
const DEFAULT_TEXT_POSITION = "top";
const DEFAULT_LOCALE = "en-US";


const DIFF_METHOD = {
    ratio: (x, y) => x / y,
    percent: (x, y) => 100*(x/y - 1),
    diff: (x, y) => x - y,
};


const DIFF_SUFFIX = {
    ratio: '',
    percent: '%',
    diff: '',
}


const DEFAULT_COLOR_SCHEME = {
    ColorOrder: [
        [0, 114, 189, 1],
        [217, 83, 25, 1],
        [237, 177, 32, 1],
        [126, 47, 142, 1],
        [119, 172, 48, 1],
        [77, 190, 238, 1],
        [162, 20, 47, 1],
    ],
};


// generic function preparing the chart area and calling the implementation
// specific for the chosen ChartLibrary
function createChart(parent, chartObj) {
    let chartType = chartObj.Type.toLowerCase();
    const freq = chartObj.Settings.Frequency || 0;

    if (chartType === "serieschart" && freq === 0) {
        chartType = "linearchart";
    }

    var chartParent = document.createElement("div");
    $(chartParent).attr("id", chartObj.Id);
    $(chartParent).addClass("rephrase-chart");
    // apply custom css class to .rephrase-chart div
    if (chartObj.Settings.Class && (typeof chartObj.Settings.Class === "string"
        || chartObj.Settings.Class instanceof Array)) {
        $(chartParent).addClass(chartObj.Settings.Class);
    }
    parent.appendChild(chartParent);

    // whether to include title in canvas or make it a separate div
    const title = $ru.getTitle(chartObj);
    // create chart title
    if (title) {
        var chartTitleDiv = document.createElement("div");
        $(chartTitleDiv).addClass(["rephrase-chart-title", "h4"]);
        chartTitleDiv.innerText = title;
        chartParent.appendChild(chartTitleDiv);
    }

    // generate data for the chart
    let data = [];
    let ticks = { tickLabels: [], tickValues: [] };
    let limits = [null, null];

    switch (chartType) {
        case "serieschart":
            limits = [
                chartObj.Settings.StartDate ? new Date(chartObj.Settings.StartDate) : null,
                chartObj.Settings.EndDate ? new Date(chartObj.Settings.EndDate) : null
            ];
            break;
        case "linearchart":
            limits = [ chartObj.Settings.StartDate, chartObj.Settings.EndDate ];
            break;
        case "curvechart":
            if (chartObj.Settings.hasOwnProperty("TickLabels")) {
                ticks.tickLabels = chartObj.Settings.TickLabels;
            }
            if (chartObj.Settings.hasOwnProperty("Ticks")) {
                ticks.tickValues = chartObj.Settings.Ticks;
            }
            limits = [ 0, ((ticks.tickValues instanceof Array) && ticks.tickValues.length) ? Math.max(...ticks.tickValues) : null ];
            break;
    }

    if (chartObj.hasOwnProperty("Content") && chartObj.Content instanceof Array) {
        const colorList = $ru.colorScheme.getColorList();
        let colorCounter = -1;
        for (let childObj of chartObj.Content) {
            childObj.Settings = appendObjSettings(childObj.Settings || {}, chartObj.Settings || {});
            colorCounter = (childObj.Settings.KeepColor) ? colorCounter : ++colorCounter;
            const color = childObj.Settings.Color || colorList[colorCounter % colorList.length];
            childObj.Settings.Color = color;

            data.push($ru.createChartContent(childObj, freq, limits));

            if ($ru.test.nonemptyArray(childObj.Settings.Bands)) {
                for (let bandsObj of childObj.Settings.Bands) {
                    const colorWhitened = $ru.whitenRgba(color, bandsObj.Settings.Whitening, bandsObj.Settings.Alpha);
                    bandsObj.Settings.Color = colorWhitened;
                    bandsObj.Settings.FillColor = colorWhitened;
                    data.push($ru.createChartContent(bandsObj, freq, limits));
                }
            }

        }
    }

    const chartBody = $ru.createChartBody(chartType, data, limits, chartObj.Settings, ticks);
    chartParent.appendChild(chartBody);
}


function createChartContent(contentObj, freq, limits) {
    if (!contentObj || !(typeof contentObj === "object")
        || !contentObj.hasOwnProperty("Type") || !contentObj.Type) {
        return {};
    }
    // switch between createChartCurve and createChartSeries
    switch (contentObj.Type.toLowerCase()) {
        case "curve":
            return $ru.createChartCurve(contentObj, limits);
        case "series":
        case "bands":
            return $ru.createChartSeries(contentObj, freq, limits);
        default:
            return {};
    }
}


function createChartCurve(curveObj, limits) {
    // return empty object if smth. is wrong
    if (!curveObj.hasOwnProperty("Content") || !((typeof curveObj.Content === "string")
        || (typeof curveObj.Content === "object"
            && curveObj.Content.hasOwnProperty("Ticks")
            && curveObj.Content.hasOwnProperty("Values")))) {
        return {};
    }
    if (typeof curveObj.Content === "string") {
        curveObj.Content = $ru.databank.getEntry(curveObj.Content);
    }

    let seriesObj = $ru.createSeries(curveObj.Title, curveObj.Content.Ticks, curveObj.Content.Values, curveObj.Settings);

    if ($ru.test.nonemptyArray(curveObj.Content.Spreads)) {
        seriesObj.error_y = $ru.createSpreads(curveObj.Content.Spreads);
    }

    return seriesObj;
}


function createSpreads(spreadValues) {
    return {
        type: "data",
        symmetric: false, 
        array: spreadValues, 
        visible: true,
    };
}


function createChartSeries(seriesObj, freq, limits) {
    // return empty object if smth. is wrong
    if (!seriesObj.hasOwnProperty("Content") || !((typeof seriesObj.Content === "string")
        || (typeof seriesObj.Content === "object"
            && seriesObj.Content.hasOwnProperty("Dates")
            && seriesObj.Content.hasOwnProperty("Values")))) {
        return {};
    }

    const settings = seriesObj.Settings;

    if (typeof seriesObj.Content === "string") {
        seriesObj.Content = $ru.databank.getSeriesContent(seriesObj.Content);
    } else if (freq > 0) {
        seriesObj.Content.Dates = seriesObj.Content.Dates.map(function (d) {
            return new Date(d);
        });
    }
    return $ru.createSeries(seriesObj.Title, seriesObj.Content.Dates, seriesObj.Content.Values, seriesObj.Settings);
}

// add div that would force page break when printing
function addPageBreak(parent, _breakObj) {
    var pageBreakDiv = document.createElement("div");
    $(pageBreakDiv).attr("id", _breakObj.Id);
    $(pageBreakDiv).addClass("page-break");
    pageBreakDiv.innerHTML = "&nbsp;";
    parent.appendChild(pageBreakDiv);
}


// create chart elements 
function createChartBody(chartType, data, limits, settings, ticks) {
    const dateFormat = settings.DateFormat || "";
    const highlight = settings.Highlight || [];
    const barMode = settings.BarMode;
    const interactive = (!settings.hasOwnProperty("InteractiveCharts"))
        ? true
        : settings.InteractiveCharts;
    var chartBody = document.createElement("div");
    $(chartBody).addClass("rephrase-chart-body");

    const layout = {
        modebar: {
            add: ['hoverclosest', 'hovercompare'],
            orientation: "v",
        },
        hovermode: "x",
        showlegend: (settings.hasOwnProperty("ShowLegend")) ? settings.ShowLegend : false,
        font: {
            family: "Open Sans",
            color: "#0a0a0a",
            ...settings.Layout.font,
        },
        barmode: settings.BarMode || "group",
        xaxis: {
            type: "linear",
            dtick: null,
            xtick0: null,
            autorange: false,
            rangemode: null,
            fixedrange: false,
            gridcolor: "#dddddd",
            showline: true,
            zeroline: settings.XZeroLine,
            linecolor: "#aaaaaa",
            tickvals: null,
            ticktext: null,
            ticklabeloverflow: "hide past div",
            tickformat: "~r",
            tickmode: "auto",
            tickangle: "auto",
            mirror: true,
            ...settings.Layout.xaxis,
        },
        yaxis: {
            type: "linear",
            rangemode: "normal",
            autorange: true,
            fixedrange: false,
            tickformat: "~r",
            hoverformat: ".2r",
            gridcolor: "#dddddd",
            linecolor: "#aaaaaa",
            zeroline: settings.YZeroLine,
            mirror: true,
            showline: true,
            ...settings.Layout.yaxis,
        },
        legend: {
            bgcolor: "transparent",
            x: 0.5,
            y: 1.025,
            xanchor: "center",
            yanchor: "bottom",
            orientation: "h",
            ...settings.Layout.legend,
        },
        margin: {
            l: 50,
            r: 50,
            b: 30,
            t: 10,
            pad: 4,
            ...settings.Layout.margin,
        },
        shapes: []
    };

    switch (chartType) {
        case "serieschart":
            layout.xaxis.type = "date";
            layout.xaxis.tickformat = $ru.momentJsDateFormatToD3TimeFormat(dateFormat);
            break;
        case "linearchart":
            break;
        case "curvechart":
            layout.xaxis.tickmode = "array";
            layout.yaxis.rangemode = "tozero";
            break;
    }

    layout.xaxis.range = limits;
    layout.xaxis.tickvals = ticks.tickValues;
    layout.xaxis.ticktext = ticks.tickLabels;

    const config = {
        responsive: true,
        staticPlot: !interactive
    };

    if (!(layout.shapes instanceof Array)) {
        layout.shapes = [];
    }

    // add range highlighting if needed so (for the Series charts only)
    if ($ru.test.nonemptyArray(highlight)) {
        for (let h of highlight) {
            let shape = {
                type: "rect",
                xref: "x",
                x0: h.StartDate || settings.StartDate,
                x1: h.EndDate || settings.EndDate,
                yref: "paper",
                y0: 0,
                y1: 1,
                fillcolor: $ru.printRgba(h.Settings.FillColor || DEFAULT_HIGHLIGHT_FILLCOLOR), 
                line : Object.keys(h.Settings.Line).length ? h.Settings.Line : {"width": 0},
            };
            shape = {...shape, ...h.Settings.Shape};
            layout.shapes.push(shape);
        }
    }

    // we are adding charts only after document is ready
    // because it (1) makes the browser open quicker (almost immediately 
    // even for the huge reports), and (2) the widths of DIV containers 
    // of the charts is not 100% known before document is ready (that's how
    //  "cell auto" of XY grid behaves)
    $(document).ready(function () {
        var bBox = chartBody.getBoundingClientRect();
        layout.height = bBox.width / 1.5;
        Plotly.newPlot(chartBody, data, layout, config);
    });

    // make sure chart resizes correctly before printing
    const resizeChartWidth = function () {
        var bBox = chartBody.getBoundingClientRect();
        Plotly.relayout(chartBody, { width: bBox.width, height: bBox.height });
    };

    if (window.matchMedia) { // Webkit
        window.matchMedia('print').addListener(function (print) {
            if (print.matches) {
                resizeChartWidth();
            } else {
                Plotly.relayout(chartBody, { width: null, height: null, autosize: true })
            }
        });
    }
    window.onbeforeprint = resizeChartWidth; // FF, IE

    return chartBody;
}

// create series object for chart
function createSeries(title, dates, values, settings) {

    settings.Markers = (settings.Markers===true) ? {} : settings.Markers;

    let seriesObj = {};
    seriesObj.hoverinfo = "x+y+name+text";
    seriesObj.x = (dates instanceof Array) ? dates : [dates];
    seriesObj.y = (values instanceof Array) ? values : [values];
    seriesObj.name = title || "";
    seriesObj.type = (settings.Type || "scatter").toLowerCase();
    seriesObj.stackgroup = settings.StackGroup || "";
    seriesObj.fill = settings.Fill || "none"; // used for bands, dates and values need to explicitly go from start-date to end-date and back to start-date
    seriesObj.fillcolor = $ru.printRgba(settings.FillColor) || "transparent"; // used for bands
    seriesObj.showlegend = (!settings.hasOwnProperty("ShowLegend")) ? true : settings.ShowLegend; // exclude individual series from chart legend
    seriesObj.text = settings.Text || null;

    const autoMode = (settings.Markers) ? "lines+markers" : "lines";
    seriesObj.mode = (settings.Mode) ? settings.Mode.toLowerCase() : autoMode;

    if (seriesObj.type === "bar") {
        seriesObj.marker = {
            color: $ru.printRgba(settings.Color),
            line: {
                color: $ru.printRgba(settings.Color),
                width: 1,
            }
        };
    } else {
        seriesObj.line = {
            color: $ru.printRgba(settings.Color),
            width: settings.LineWidth,
            dash: settings.LineDash,
        };
        if (settings.Markers) {
            seriesObj.marker = settings.Markers;
            seriesObj.marker.color = $ru.printRgba(seriesObj.marker.color || settings.Color);
        }
    }
    return seriesObj;
}


function createMatrix(parent, matrixObj) {
    // by default do not round matrix numbers
    const nDecParsed = parseInt(matrixObj.Settings.NumDecimals);
    const nDecimals = isNaN(nDecParsed) ? DEFAULT_NUM_DECIMALS : nDecParsed;
    const nanValue = matrixObj.Settings.NaN;
    var matrixParent = document.createElement("div");
    $(matrixParent).attr("id", matrixObj.Id);
    $(matrixParent).addClass("rephrase-matrix");
    // apply custom css class to .rephrase-matrix div
    if (matrixObj.Settings.Class && (typeof matrixObj.Settings.Class === "string"
        || matrixObj.Settings.Class instanceof Array)) {
        $(matrixParent).addClass(matrixObj.Settings.Class);
    }
    parent.appendChild(matrixParent);
    // create title
    if (matrixObj.Title) {
        var matrixTitle = document.createElement("div");
        $(matrixTitle).addClass(["rephrase-matrix-title", "h3"]);
        matrixTitle.innerText = matrixObj.Title;
        matrixParent.appendChild(matrixTitle);
    }
    var matrixBodyDiv = document.createElement("div");
    $(matrixBodyDiv).addClass(["rephrase-matrix-body", "table-scroll"]);
    matrixParent.appendChild(matrixBodyDiv);
    // create content
    if (matrixObj.Content && (matrixObj.Content instanceof Array) && matrixObj.Content.length > 0) {
        var matrix = document.createElement("table");
        $(matrix).addClass(["rephrase-matrix-table", "hover", "unstriped"]);
        // apply custom css class to .rephrase-matrix-table div
        if (matrixObj.Settings.Class && (typeof matrixObj.Settings.Class === "string"
            || matrixObj.Settings.Class instanceof Array)) {
            $(matrix).addClass(matrixObj.Settings.Class);
        }
        matrixBodyDiv.appendChild(matrix);
        // initiate matrix header column if needed
        const hasColumnNames = (matrixObj.Settings.ColumnNames && (matrixObj.Settings.ColumnNames instanceof Array) && matrixObj.Settings.ColumnNames.length > 0);
        const hasRowNames = (matrixObj.Settings.RowNames && (matrixObj.Settings.RowNames instanceof Array) && matrixObj.Settings.RowNames.length > 0);
        if (hasColumnNames) {
            var thead = document.createElement("thead");
            $(thead).addClass('rephrase-matrix-header');
            matrix.appendChild(thead);
            var theadRow = document.createElement("tr");
            thead.appendChild(theadRow);
            if (hasRowNames) {
                var theadFirstCell = document.createElement("th");
                $(theadFirstCell).addClass(['rephrase-matrix-header-cell', 'rephrase-matrix-header-cell-col', 'rephrase-matrix-header-cell-row']);
                theadRow.appendChild(theadFirstCell);
            }
            for (let i = 0; i < matrixObj.Settings.ColumnNames.length; i++) {
                const cName = matrixObj.Settings.ColumnNames[i];
                var theadCell = document.createElement("th");
                $(theadCell).addClass(['rephrase-matrix-header-cell', 'rephrase-matrix-header-cell-col']);
                theadCell.innerText = cName;
                theadRow.appendChild(theadCell);
            }
        }
        var tbody = document.createElement("tbody");
        $(tbody).addClass('rephrase-matrix-table-body');
        matrix.appendChild(tbody);
        const cellClasses = matrixObj.Settings.CellClasses;
        // populate table body
        for (var i = 0; i < matrixObj.Content.length; i++) {
            var tbodyRow = document.createElement("tr");
            tbody.appendChild(tbodyRow);
            const matrixRow = matrixObj.Content[i];
            const cellClassesRow = (cellClasses instanceof Array) ? cellClasses[i] : null;
            if (hasRowNames) {
                const rName = matrixObj.Settings.RowNames[i];
                var theadCell = document.createElement("th");
                $(theadCell).addClass(['rephrase-matrix-header-cell', 'rephrase-matrix-header-cell-row']);
                theadCell.innerText = rName;
                tbodyRow.appendChild(theadCell);
            }
            for (let j = 0; j < matrixRow.length; j++) {
                const cellValue = $ru.printTableValue(matrixRow[j], nDecimals, nanValue);
                const cellClass = (cellClassesRow instanceof Array) ? cellClassesRow[j] : null;
                var tbodyDataCell = document.createElement("td");
                $(tbodyDataCell).addClass('rephrase-matrix-data-cell');
                if (cellClass) {
                    $(tbodyDataCell).addClass(cellClass);
                }
                tbodyDataCell.innerText = cellValue;
                tbodyRow.appendChild(tbodyDataCell);
            }
        }
    }
}

function createTextBlock(parent, textObj) {
    var textParent = document.createElement("div");
    $(textParent).attr("id", textObj.Id);
    $(textParent).addClass("rephrase-text-block");
    // apply custom css class to .rephrase-text-block div
    if (textObj.Settings.Class && (typeof textObj.Settings.Class === "string"
        || textObj.Settings.Class instanceof Array)) {
        $(textParent).addClass(textObj.Settings.Class);
    }
    parent.appendChild(textParent);
    // create title
    if (textObj.Title) {
        var textTitle = document.createElement("h2");
        $(textTitle).addClass("rephrase-text-block-title");
        textTitle.innerText = textObj.Title;
        textParent.appendChild(textTitle);
    }
    // create content
    if (textObj.Content && (typeof textObj.Content === "string")) {
        var textContent = document.createElement("div");
        $(textContent).addClass("rephrase-text-block-body");
        if (textObj.Settings.HighlightCodeBlocks) {
            const renderer = new marked.Renderer();
            renderer.code = function (code, lang) {
                const isIris = (lang.toLowerCase() === "iris");
                if (isIris) {
                    lang = "matlab";
                }
                const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
                const theCode = "<pre><code class=\"hljs"
                    + (validLang ? " language-" + validLang : "")
                    + "\">" + hljs.highlight(validLang, code).value
                    + "</code></pre>";
                // add IRIS specific highlighting on the top of MATLAB's
                return (isIris) ? postProcessIrisCode(postProcessMatlabCode(theCode)) : postProcessMatlabCode(theCode);
            }
            marked.setOptions({
                renderer: renderer
            });
        }
        textContent.innerHTML = marked.parse(textObj.Content);
        textParent.appendChild(textContent);
        if (textObj.Settings.ParseFormulas) {
            window.renderMathInElement(textContent, {
                // no options so far
            });
        }
    }
}

function postProcessMatlabCode(code) {
    // add missing stuff to Matlab highlighting

    // make %%-comments bold
    code = code.replace(/(\<span class\=['"]hljs\-comment)(['"]\>\s*%%\s+.*?\<\/span\>)/gim, "$1 hljs-bold$2");

    return code;
}

function postProcessIrisCode(code) {
    // add hljs classes to IRIS specific keywords

    // todo: implement this properly

    // make all words starting with "!" a keywords (.hljs-keyword)
    code = code.replace(/(![a-zA-Z_]*)/gim, "<span class='hljs-keyword'>$1</span>");
    // highlight lags and leads (.hljs-symbol)
    code = code.replace(/\{\<span class\=['"]hljs\-number['"]\>([\+\-]?\d+)\<\/span\>\}/gim, "<span class='hljs-symbol'>{$1}</span>");

    return code;
}


function momentJsDateFormatToD3TimeFormat(dateFormat) {
    // percent sign has a special meaning in D3
    var d3TimeFormat = dateFormat.replace("%", "%%");
    // moment.js [] escape -- temporary take them out
    var escaped = [];
    var re = /\[(.*?)\]/ig;
    var match = re.exec(d3TimeFormat);
    while (match !== null) {
        escaped.push(match[1]);
        match = re.exec(d3TimeFormat);
    }
    d3TimeFormat = d3TimeFormat.replace(re, "[]");
    // years
    d3TimeFormat = d3TimeFormat.replace("YYYY", "%Y");
    d3TimeFormat = d3TimeFormat.replace("YY", "%y");
    d3TimeFormat = d3TimeFormat.replace(/(^|[^%])Y/g, "$1%-Y");
    // quarters
    d3TimeFormat = d3TimeFormat.replace("QQ", "0%q");
    d3TimeFormat = d3TimeFormat.replace("Q", "%q");
    // months
    d3TimeFormat = d3TimeFormat.replace("MMMM", "%B");
    d3TimeFormat = d3TimeFormat.replace("MMM", "%b");
    d3TimeFormat = d3TimeFormat.replace("MM", "%m");
    d3TimeFormat = d3TimeFormat.replace("M", "%-m");
    // week days
    d3TimeFormat = d3TimeFormat.replace("dddd", "%A");
    d3TimeFormat = d3TimeFormat.replace("ddd", "%a");
    // days
    d3TimeFormat = d3TimeFormat.replace("DDDD", "%j");
    d3TimeFormat = d3TimeFormat.replace("DDD", "%j");
    d3TimeFormat = d3TimeFormat.replace("DD", "%d");
    d3TimeFormat = d3TimeFormat.replace("D", "%-d");
    // moment.js [] escape -- put them back
    var i = 0;
    d3TimeFormat = d3TimeFormat.replace(/\[\]/g, function () { return escaped[i++]; });
    return d3TimeFormat;
}


function getColorList() {
    return ($colorScheme.ColorOrder || DEFAULT_COLOR_SCHEME.ColorOrder);
}


function printRgba(colorArray) {
    if (colorArray === 'transparent' || colorArray === 'half-transparent') {
        return colorArray;
    } else if (colorArray && colorArray.length===4) {
        return 'rgba(' + colorArray + ')';
    } else {
        return undefined;
    }
}


function whitenRgba(colorArray, whitening, alpha) {
    if (colorArray && colorArray.length === 4 && typeof whitening === 'number') {
        alpha = alpha || colorArray[3];
        return [...colorArray.slice(0, 3).map(x => x*(1-whitening) + 255*whitening), alpha];
    } else {
        return colorArray;
    }
}


function createTable(parent, tableObj) {
    const TABLE_DATA_ROW_TYPES = ["series", "diffseries"]; 
    // create a div to wrap the table
    var tableParent = document.createElement("div");
    $(tableParent).attr("id", tableObj.Id);
    $(tableParent).addClass(["rephrase-table-parent", "table-scroll"]);
    parent.appendChild(tableParent);
    // create table title
    if (tableObj.Title) {
        var tableTitle = document.createElement("h3");
        $(tableTitle).addClass("rephrase-table-title");
        tableTitle.innerText = tableObj.Title;
    }
    tableParent.appendChild(tableTitle);
    // what rows to display
    tableObj.Settings.DisplayRows = tableObj.Settings.DisplayRows || {
        "Diff": true,
        "Baseline": false,
        "Alternative": false
    };
    const isDiffTable = tableObj.Content.findIndex(function (el) { return el.Type.toLowerCase() === "diffseries"; }) !== -1;
    if (isDiffTable) {
        // create button group
        var buttonGroup = document.createElement("div");
        $(buttonGroup).addClass(["small", "button-group", "rephrase-diff-table-button-group"]);
        var showBaselineBtn = document.createElement("a");
        showBaselineBtn.innerText = "Hide Baseline";
        $(showBaselineBtn).addClass(["button", "rephrase-diff-table-button", "rephrase-diff-table-button-show-baseline"]);
        if (!tableObj.Settings.DisplayRows.Baseline) {
            showBaselineBtn.innerText = "Show Baseline";
            $(showBaselineBtn).addClass("hollow");
        }
        showBaselineBtn.addEventListener("click", onBtnClick, false);
        buttonGroup.appendChild(showBaselineBtn);
        var showAlternativeBtn = document.createElement("a");
        showAlternativeBtn.innerText = "Hide Alternative";
        $(showAlternativeBtn).addClass(["button", "rephrase-diff-table-button", "rephrase-diff-table-button-show-alternative"]);
        if (!tableObj.Settings.DisplayRows.Alternative) {
            showAlternativeBtn.innerText = "Show Alternative";
            $(showAlternativeBtn).addClass("hollow");
        }
        showAlternativeBtn.addEventListener("click", onBtnClick, false);
        buttonGroup.appendChild(showAlternativeBtn);
        var showDiffBtn = document.createElement("a");
        showDiffBtn.innerText = "Hide Diff";
        $(showDiffBtn).addClass(["button", "rephrase-diff-table-button", "rephrase-diff-table-button-show-diff"]);
        if (!tableObj.Settings.DisplayRows.Diff) {
            showDiffBtn.innerText = "Show Diff";
            $(showDiffBtn).addClass("hollow");
        }
        showDiffBtn.addEventListener("click", onBtnClick, false);
        buttonGroup.appendChild(showDiffBtn);
        tableParent.appendChild(buttonGroup);
    }
    var table = document.createElement("table");
    $(table).addClass(["rephrase-table", "hover", "unstriped"]);
    // apply custom css class to .rephrase-chart div
    if (tableObj.Settings.Class && (typeof tableObj.Settings.Class === "string"
        || tableObj.Settings.Class instanceof Array)) {
        $(table).addClass(tableObj.Settings.Class);
    }
    tableParent.appendChild(table);
    // initiate table header and body
    var thead = document.createElement("thead");
    $(thead).addClass('rephrase-table-header');
    table.appendChild(thead);
    var theadRow = document.createElement("tr");
    $(theadRow).addClass('rephrase-table-header-row');
    thead.appendChild(theadRow);
    var tbody = document.createElement("tbody");
    $(tbody).addClass('rephrase-table-body');
    table.appendChild(tbody);
    // create title column in header
    var theadFirstCell = document.createElement("th");
    $(theadFirstCell).addClass('rephrase-table-header-cell rephrase-table-first-cell');
    theadFirstCell.innerText = tableObj.Settings.FirstCell;
    theadRow.appendChild(theadFirstCell);
    // create units column in header
    const showUnits = tableObj.Settings.ShowUnits;
    if (showUnits) {
        var theadFirstCell = document.createElement("th");
        $(theadFirstCell).addClass('rephrase-table-header-cell rephrase-table-units-column');
        theadFirstCell.innerText = tableObj.Settings.UnitsHeading;
        theadRow.appendChild(theadFirstCell);
    }
    // re-format the date string and populate table header
    const dateFormat = tableObj.Settings.DateFormat;
    const dates = tableObj.Settings.Dates.map(function (d) {
        const t = moment(new Date(d)).format(dateFormat);
        var theadDateCell = document.createElement("th");
        $(theadDateCell).addClass('rephrase-table-header-cell');
        theadDateCell.innerText = t;
        theadRow.appendChild(theadDateCell);
        return t;
    });
    // populate table body
    for (var i = 0; i < tableObj.Content.length; i++) {
        const tableRowObj = tableObj.Content[i];
        // skip this entry if it's neither a SERIES nor HEADING or if smth. else is wrong
        if (!tableRowObj.hasOwnProperty("Type")
            || !["diffseries", "series", "heading"].includes(tableRowObj.Type.toLowerCase())
            || (tableRowObj.Type.toLowerCase() === "series"
                && (!tableRowObj.hasOwnProperty("Content")
                    || !((typeof tableRowObj.Content === "string")
                        || (typeof tableRowObj.Content === "object"
                            && tableRowObj.Content.hasOwnProperty("Dates")
                            && tableRowObj.Content.hasOwnProperty("Values")
                            && (dates instanceof Array)
                            && tableRowObj.Content.Values.length === dates.length))))
            || (tableRowObj.Type.toLowerCase() === "diffseries"
                && (!tableRowObj.hasOwnProperty("Content")
                    || !((tableRowObj.Content instanceof Array)
                        && ((typeof tableRowObj.Content[0] === "string")
                            || (typeof tableRowObj.Content[0] === "object"
                                && tableRowObj.Content[0].hasOwnProperty("Dates")
                                && tableRowObj.Content[0].hasOwnProperty("Values")
                                && (dates instanceof Array)
                                && tableRowObj.Content[0].Values.length === dates.length)))))) {
            continue;
        }

        // create new table row
        const isDataRow = TABLE_DATA_ROW_TYPES.includes(tableRowObj.Type.toLowerCase());
        var tbodyRow = document.createElement("tr");
        $ru.addUserClass(tbodyRow, tableRowObj);

        tbody.appendChild(tbodyRow);
        $(tbodyRow).addClass(['rephrase-table-row', isDataRow ? 'rephrase-table-data-row' : 'rephrase-table-heading-row']);

        // create title cell
        if (isDataRow) {
            // series or diffseries
            tableRowObj.Settings = appendObjSettings(tableRowObj.Settings || {}, tableObj.Settings || {});
            $ru.createTableSeries(tbodyRow, tableRowObj, showUnits);
        } else {
            // heading
            var tbodyTitleCell = document.createElement("td");
            // $(tbodyTitleCell).addClass('h5');
            tbodyTitleCell.setAttribute('colspan', dates.length + 1);
            tbodyTitleCell.innerText = tableRowObj.Title || "";
            tbodyRow.appendChild(tbodyTitleCell);
        }
    }
    if (!tableObj.Settings.DisplayRows.Diff) {
        toggleRows(tableParent, "hide", "diff");
    }
    if (!tableObj.Settings.DisplayRows.Baseline) {
        toggleRows(tableParent, "hide", "baseline");
    }
    if (!tableObj.Settings.DisplayRows.Alternative) {
        toggleRows(tableParent, "hide", "alternative");
    }
    // button click event handler
    function onBtnClick(event) {
        const thisBtn = event.target;
        const tableParent = $(thisBtn).parent().parent();
        const otherBtn1 = $(thisBtn).siblings()[0];
        const otherBtn2 = $(thisBtn).siblings()[1];
        const isDiff = $(thisBtn).hasClass("rephrase-diff-table-button-show-diff");
        const isBaseline = $(thisBtn).hasClass("rephrase-diff-table-button-show-baseline");
        const btnType = isDiff ? "diff" : (isBaseline ? "baseline" : "alternative");
        if ($(thisBtn).hasClass("hollow")) {
            // toggle ON
            $(thisBtn).removeClass("hollow");
            thisBtn.innerText = thisBtn.innerText.replace("Show", "Hide");
            toggleRows(tableParent, "show", btnType);
        } else if (!($(otherBtn1).hasClass("hollow") && $(otherBtn2).hasClass("hollow"))) {
            // toggle OFF (if the other buttons are not OFF both)
            $(thisBtn).addClass("hollow");
            thisBtn.innerText = thisBtn.innerText.replace("Hide", "Show");
            toggleRows(tableParent, "hide", btnType);
        }
    }
    // show/hide the specified rows of the diff table
    function toggleRows(tableParent, toggleState, btnType) {
        const rows = (btnType === "diff")
            ? $(tableParent).find(".rephrase-diff-table-data-row-diff")
            : ((btnType === "baseline")
                ? $(tableParent).find(".rephrase-diff-table-data-row-baseline")
                : $(tableParent).find(".rephrase-diff-table-data-row-alternative"));
        for (var i = 0; i < rows.length; i++) {
            const row = rows[i];
            row.style.display = (toggleState === "hide") ? "none" : "";
        }
    }
}


function createTableSeries(tbodyRow, tableRowObj, showUnits) {
    // number of decimals when showing numbers
    const nDecParsed = parseInt(tableRowObj.Settings.NumDecimals);
    const nDecimals = isNaN(nDecParsed) ? DEFAULT_NUM_DECIMALS : nDecParsed;
    const diffMethod = (tableRowObj.Settings.Method || "Difference").toLowerCase();
    const nanValue = tableRowObj.Settings.NaN;
    // Title in first column
    var tbodyTitleCell = document.createElement("td");
    $(tbodyTitleCell).addClass('rephrase-table-data-row-title');
    tbodyTitleCell.innerText = tableRowObj.Title || "";
    tbodyRow.appendChild(tbodyTitleCell);
    // Units
    if (showUnits) {
        var tbodyTitleCell = document.createElement("td");
        $(tbodyTitleCell).addClass('rephrase-table-data-row-title rephrase-table-units-column');
        tbodyTitleCell.innerText = tableRowObj.Settings.Units || "";
        tbodyRow.appendChild(tbodyTitleCell);
    }
    // create data cells
    if (tableRowObj.Type.toLowerCase() === "diffseries") {
        //
        // data cells for diffseries
        //
        $(tbodyRow).addClass("rephrase-diff-table-data-row-title");
        tbodyTitleCell.setAttribute('colspan', tableRowObj.Settings.Dates.length + 1);

        let diffRow = $ru.table.createDifftableSeriesRow('Diff',tableRowObj.Settings, showUnits);
        let baselineRow = $ru.table.createDifftableSeriesRow('Baseline', tableRowObj.Settings, showUnits);
        let alternativeRow = $ru.table.createDifftableSeriesRow('Alternative', tableRowObj.Settings, showUnits);

        var baselineSeries = (typeof tableRowObj.Content[0] === "string")
            ? $ru.databank.getSeriesContent(tableRowObj.Content[0])
            : tableRowObj.Content[0];

        var alternativeSeries = (typeof tableRowObj.Content[1] === "string")
            ? $ru.databank.getSeriesContent(tableRowObj.Content[1])
            : tableRowObj.Content[1];

        let diffFunc = DIFF_METHOD[diffMethod] || DIFF_METHOD.diff;
        let diffSuffix = DIFF_SUFFIX[diffMethod] || DIFF_SUFFIX.diff;

        for (var j = 0; j < Math.max(baselineSeries.Values.length, alternativeSeries.Values.length); j++) {
            const v1 = (baselineSeries.Values[j] === null) ? NaN : baselineSeries.Values[j];
            const v2 = (alternativeSeries.Values[j] === null) ? NaN : alternativeSeries.Values[j];
            const vDiff = diffFunc(v2, v1);

            var baselineDataCell = document.createElement("td");
            $(baselineDataCell).addClass(['rephrase-table-data-cell', 'rephrase-diff-table-data-cell-baseline', $ru.table.getTableNumberClass(v1)]);
            $(baselineDataCell).addClass($ru.table.evalConditionals(v1, tableRowObj.Settings.Conditional.Baseline));
            baselineDataCell.innerText = $ru.printTableValue(v1, nDecimals, nanValue); 
            baselineRow.appendChild(baselineDataCell);

            var alternativeDataCell = document.createElement("td");
            $(alternativeDataCell).addClass(['rephrase-table-data-cell', 'rephrase-diff-table-data-cell-alternative', $ru.table.getTableNumberClass(v2)]);
            $(alternativeDataCell).addClass($ru.table.evalConditionals(v2, tableRowObj.Settings.Conditional.Alternative));
            alternativeDataCell.innerText = $ru.printTableValue(v2, nDecimals, nanValue);
            alternativeRow.appendChild(alternativeDataCell);

            var diffDataCell = document.createElement("td");
            $(diffDataCell).addClass(['rephrase-table-data-cell', 'rephrase-diff-table-data-cell-diff', $ru.table.getTableNumberClass(vDiff)]);
            $(diffDataCell).addClass($ru.table.evalConditionals(vDiff, tableRowObj.Settings.Conditional.Diff));
            diffDataCell.innerText = $ru.printTableValue(vDiff, nDecimals, nanValue) + diffSuffix;
            diffRow.appendChild(diffDataCell);
        }
        $(tbodyRow).after(baselineRow);
        $(baselineRow).after(alternativeRow);
        $(alternativeRow).after(diffRow);
    } else {
        //
        // data cells for series
        //
        if (typeof tableRowObj.Content === "string") {
            tableRowObj.Content = $ru.databank.getSeriesContent(tableRowObj.Content);
        }
        for (let j = 0; j < tableRowObj.Content.Values.length; j++) {
            const v = (tableRowObj.Content.Values[j] === null) ? NaN : tableRowObj.Content.Values[j];
            let tbodyDataCell = document.createElement("td");
            $(tbodyDataCell).addClass(['rephrase-table-data-cell', $ru.table.getTableNumberClass(v)]);
            tbodyDataCell.innerText = $ru.printTableValue(v, nDecimals, nanValue);
            $(tbodyDataCell).addClass($ru.table.evalConditionals(v, tableRowObj.Settings.Conditional));
            tbodyRow.appendChild(tbodyDataCell);
        }
    }
}


function getTableNumberClass(value) {
    if (isNaN(value)) { return 'rephrase-table-data-nan'; }
    else if (value === 0) { return 'rephrase-table-data-zero'; }
    else if (value < 0) { return 'rephrase-table-data-negative'; }
    else if (value > 0) { return 'rephrase-table-data-positive'; }
    else { return 'rephrase-table-data-other'; }
}


function evalConditionals(value, conditionals) {
    if (!conditionals) { return "" }
    return conditionals.filter(
        x => (x.Bounds[0] || -Infinity)<=value && value<=(x.Bounds[1] || Infinity)
    ).map(x => x.Class);
}


function createDifftableSeriesRow(rowType, settings, showUnits) {
    let row = document.createElement("tr");
    $(row).addClass(sprintf('rephrase-diff-table-data-row-%s', rowType.toLowerCase()));
    let rowTitleCell = document.createElement("td");
    $(rowTitleCell).addClass(['rephrase-table-data-row-title', sprintf('rephrase-diff-table-data-row-%s-title', rowType.toLowerCase())]);
    rowTitleCell.setAttribute('colspan', 1+showUnits);
    rowTitleCell.innerText = 
        (settings.RowTitles && settings.RowTitles[rowType])
        ? settings.RowTitles[rowType] : rowType;
    row.appendChild(rowTitleCell);
    return row;
}


function createGrid(parent, gridObj) {
    // create a parent div elements for rows
    var gridRowParent = document.createElement("div");
    $(gridRowParent).attr("id", gridObj.Id);
    $(gridRowParent).addClass(["rephrase-grid", "grid-y", "grid-padding-y"]);
    parent.appendChild(gridRowParent);

    // Create grid title
    const title = $ru.getTitle(gridObj);
    if (title) {
        const gridTitleElement = document.createElement("h2");
        $(gridTitleElement).addClass("rephrase-grid-title");
        gridTitleElement.innerText = title;
        gridRowParent.appendChild(gridTitleElement);
    }

    const nTiles = gridObj.Content.length; 
    const nCols = gridObj.Settings.NumColumns;
    const nRows = Math.ceil(nTiles / nCols);
    // const nRows = gridObj.Settings.NumRows;
    // populate rows
    for (var i = 0; i < nRows; i++) {
        // create row
        var gridRow = document.createElement("div");
        $(gridRow).addClass(["cell", "shrink"]);
        gridRowParent.appendChild(gridRow);
        // create parent div for this row's columns
        var gridColParent = document.createElement("div");
        $(gridColParent).addClass(["grid-x", "grid-padding-x"]);
        gridRow.appendChild(gridColParent);
        // populate this row's columns
        for (let j = 0; j < nCols; j++) {
            const contentIndex = nCols * i + j;
            var gridCol = document.createElement("div");
            $(gridCol).addClass(["cell", "auto"]);
            gridColParent.appendChild(gridCol);
            const gridElementObj = gridObj.Content[contentIndex];
            $ru.addReportElement(gridCol, gridElementObj, gridObj.Settings);
        }
    }
}


function createPager(parent, pagerObj) {
    // create a parent div element for the pager
    var pagerParent = document.createElement("div");
    $(pagerParent).attr("id", pagerObj.Id);
    $(pagerParent).addClass(["rephrase-pager"]);
    parent.appendChild(pagerParent);

    // create pager title
    const title = $ru.getTitle(pagerObj);
    if (title) {
        const pagerTitleElement = document.createElement("h2");
        $(pagerTitleElement).addClass("rephrase-pager-title");
        pagerTitleElement.innerText = title;
        pagerParent.appendChild(pagerTitleElement);
    }

    const nPages = pagerObj.Content.length;
    const sliderArea = document.createElement("div");
    $(sliderArea).addClass(["rephrase-pager-slider-area", "grid-x", "grid-margin-x"]);
    $(pagerParent).append(sliderArea);

    const sliderParent = document.createElement("div");
    sliderParent.setAttribute("data-slider", "");
    $(sliderParent).addClass(["rephrase-pager-slider", "slider"]);
    $(sliderParent).append("<span class='slider-handle' data-slider-handle role='slider' tabindex='1'></span>");
    $(sliderParent).append("<span class='slider-fill' data-slider-fill></span>");
    $(sliderParent).append("<input type='hidden'>");

    if (nPages == 1) {
        $(sliderParent).addClass("disabled");
    }
    $(sliderArea).append($("<div class='cell auto'></div>").append($(sliderParent)));

    var sliderButtons = $("<div class='cell small-2'></div>");

    const dropdownArea = $("<div class='rephrase-pager-dropdown-area'></div>");
    const dropdownSelect = $("<select></select>")
        .on("change", function() {
            updateSliderTo(this.value);
        });
    dropdownSelect.addClass("h3");

    for (let i = 0; i < nPages; i++) {
        const title = pagerObj.Content[i].Title || `Untitled page {i}`;
        dropdownSelect.append($(`<option value='${i}'>${title}</option>`));
        pagerObj.Content[i].Settings.ShowTitle = false;
    }
    dropdownArea.append(dropdownSelect);
    $(pagerParent).append(dropdownArea);

    var prevButton = $("<a class='button hollow rephrase-pager-slider-prev-button' accesskey=','>&lt;&lt;</a>")
        .on("click", function () {
            updateSliderBy(-1);
        });

    var nextButton = $("<a class='button hollow rephrase-pager-slider-next-button' accesskey='.'>&gt;&gt;</a>")
        .on("click", function () {
            updateSliderBy(1);
        });

    $(sliderParent).find("input")[0].value = 0;

    sliderButtons.append(prevButton);
    sliderButtons.append(nextButton);

    $(sliderArea).append(sliderButtons);
    $(sliderParent).on('changed.zf.slider', function () {
        showPage($(sliderParent).find("input")[0].value);
    });
    const startPage = Math.min(nPages - 1, pagerObj.Settings.StartPage || 0);
    var s = new Foundation.Slider($(sliderParent), {
        initialStart: startPage,
        end: nPages - 1
    });
    // show 1st page or the page specified in StartPage 
    showPage(startPage);

    // function updating value of the slider by an increment
    function updateSliderBy(sign) {
        const input = $(sliderParent).find("input");
        const oldVal = +input.val();
        const newVal = Math.min(nPages, Math.max(0, oldVal + sign));
        if (oldVal !== newVal) {
            input.val(newVal).trigger('change');
            updateButtons();
        }
    }

    // function updating value of the slider to a value
    function updateSliderTo(newVal) {
        var input = $(sliderParent).find("input");
        const oldVal = +input.val();
        if (oldVal !== newVal) {
            input.val(newVal).trigger('change');
            updateButtons();
        }
    }

    function updateButtons() {
        const val = $(sliderParent).find("input").val();
        if (val != 0) {
            prevButton.removeClass("disabled");
            prevButton.removeAttr("aria-disabled");
        } else {
            prevButton.addClass("disabled");
            prevButton.attr("aria-disabled", "");
        }
        if (val != nPages - 1) {
            nextButton.removeClass("disabled");
            nextButton.removeAttr("aria-disabled");
        } else {
            nextButton.addClass("disabled");
            nextButton.attr("aria-disabled", "");
        }
        dropdownSelect[0].value = val;
    }


    // function showing or creating selected page and hiding the others
    function showPage(p) {
        $(pagerParent).find(".rephrase-pager-page").hide();
        var thisPage = $(pagerParent).find("#page" + p + ".rephrase-pager-page");
        if (!thisPage.length) {
            var page = document.createElement("div");
            $(page).addClass(["rephrase-pager-page"]);
            $(page).attr("id", "page" + p);
            pagerParent.appendChild(page);
            $ru.addReportElement(page, pagerObj.Content[p], pagerObj.Settings);
        } else {
            thisPage.show();
        }
        updateButtons();
    }
}


// wrapper element for cascading its settings down the ladder
function createSection(parent, sectionObj) {
    // create a parent div element for the section
    var sectionParent = document.createElement("div");
    $(sectionParent).attr("id", sectionObj.Id);
    $(sectionParent).addClass(["rephrase-section"]);
    parent.appendChild(sectionParent);

    // create section title
    const title = $ru.getTitle(sectionObj);
    if (title) {
        var sectionTitleElement = document.createElement(
            (sectionObj.Settings && sectionObj.Settings.Tag)
            ? sectionObj.Settings.Tag
            : "h2"
        );
        $(sectionTitleElement).addClass("rephrase-pager-title");
        sectionTitleElement.innerText = title;
        sectionParent.appendChild(sectionTitleElement);
    }

    const sectionContent = (sectionObj.Content instanceof Array)
        ? sectionObj.Content
        : [sectionObj.Content];
    for (let i = 0; i < sectionContent.length; i++) {
        const elementObj = sectionContent[i];
        $ru.addReportElement(sectionParent, elementObj, sectionObj.Settings);
    }
}


// wrapper element for cascading its settings down the ladder
function createWrapper(parent, wrapperObj) {
    for (let elementObj of wrapperObj.Content) {
        $ru.addReportElement(parent, elementObj, wrapperObj.Settings);
    }
}


function addReportElement(parentElement, elementObj, parentObjSettings) {
    // do nothing if smth. is wrong
    if (!elementObj || !(typeof elementObj === "object") || !elementObj.hasOwnProperty("Type")) {
        return {};
    }
    elementObj.Settings = appendObjSettings(elementObj.Settings || {}, parentObjSettings || {});
    switch (elementObj.Type.toLowerCase()) {
        case "chart":
        case "serieschart":
        case "linearchart":
        case "curvechart":
            $ru.createChart(parentElement, elementObj);
            break;
        case "table":
            $ru.createTable(parentElement, elementObj);
            break;
        case "matrix":
            $ru.createMatrix(parentElement, elementObj);
            break;
        case "grid":
            $ru.createGrid(parentElement, elementObj);
            break;
        case "pager":
            $ru.createPager(parentElement, elementObj);
            break;
        case "text":
            $ru.createTextBlock(parentElement, elementObj);
            break;
        case "section":
            $ru.createSection(parentElement, elementObj);
            break;
        case "wrapper":
            $ru.createWrapper(parentElement, elementObj);
            break;
        case "pagebreak":
            $ru.addPageBreak(parentElement, elementObj);
            break;
        default:
            console.log("Unknown report element");
            break;
    }
}


function getElementIds(content) {
    var ids = [];
    const thisContent = (content instanceof Array) ? content : [content];
    for (var i = 0; i < thisContent.length; i++) {
        if (!thisContent[i]) {
            continue;
        }
        if (thisContent[i].hasOwnProperty("Id")) {
            ids.push(thisContent[i].Id);
        }
        if (thisContent[i].hasOwnProperty("Content")
            && (thisContent[i].Content instanceof Array || (typeof thisContent[i].Content === "object"))) {
            ids = ids.concat(getElementIds(thisContent[i].Content));
        }
    }
    return ids;
}


function generateToc(parentList, content, depth, excludeTypes) {
    const thisContent = (content instanceof Array) ? content : [content];

    for (var i = 0; i < thisContent.length; i++) {
        if (thisContent[i] && (typeof thisContent[i] === "object")
            && thisContent[i].hasOwnProperty("Id")
            && thisContent[i].hasOwnProperty("Type")
            && !excludeTypes.includes(thisContent[i].Type)) {
            var tocMenuEntry = document.createElement("li");
            $(tocMenuEntry).addClass("report-toc-menu-entry");
            var tocMenuEntryLink = document.createElement("a");
            $(tocMenuEntryLink).addClass("report-toc-menu-entry-link");
            $(tocMenuEntryLink).attr('href', '#' + thisContent[i].Id);
            $(tocMenuEntryLink).text(thisContent[i].Title || "Untitled element");
            tocMenuEntry.appendChild(tocMenuEntryLink);
            // check if there's a child content and the depth requires creating the submenu
            if (depth > 1 && thisContent[i].Type.toLowerCase() !== "pager"
                && thisContent[i].hasOwnProperty("Content")
                && (typeof thisContent[i].Content === "object")) {
                var tocSubMenu = document.createElement("ul");
                $(tocSubMenu).addClass(["nested", "vertical", "menu", "report-toc-menu-content"]);
                tocSubMenu = $ru.generateToc(tocSubMenu, thisContent[i].Content, depth - 1, excludeTypes);
                tocMenuEntry.appendChild(tocSubMenu);
            }
            parentList.appendChild(tocMenuEntry);
        }
    }
    return parentList;
}


// copy parent object settings to the current one if the setting
// is not present in the current object yet
// todo: perhaps we need to make the process more sophisticated,
//       taking only the settings that are specific to the current 
//       object or its possible children
function appendObjSettings(objSettings, parentSettings) {
    const parentKeys = Object.keys(parentSettings);
    for (let i = 0; i < parentKeys.length; i++) {
        const key = parentKeys[i];
        if (key.toLowerCase() === "class") {
            continue
        }
        if (!objSettings.hasOwnProperty(key)) {
            objSettings[key] = parentSettings[key];
        }
    }
    return objSettings;
}


// Get the element title or empty string is ShowTitle==false
function getTitle(obj) {
    return (obj.Settings.hasOwnProperty("ShowTitle") && !obj.Settings.ShowTitle) ? "" : obj.Title;
}


function addUserClass(element, reportObj) {
    if (reportObj.Settings.Class && (typeof reportObj.Settings.Class === "string" || reportObj.Settings.Class instanceof Array)) {
        $(element).addClass(reportObj.Settings.Class);
    }
}


function printTableValue(value, nDecimals, nanValue) {
    if (typeof value === "string") {
        return value;
    } else {
        return (value || value === 0) ?
            $ru.formatNumericValue(value, nDecimals) :
            nanValue 
        ;
    }
}


function formatNumericValue(value, nDecimals) {
    const format = (nDecimals > 0) ? {minimumFractionDigits: nDecimals, maximumFractionDigits: nDecimals} : {};
    return typeof value === "number" ? value.toLocaleString(DEFAULT_LOCALE, format) : value;
}

