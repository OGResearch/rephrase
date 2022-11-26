# install NPM packages needed for bundling
# npm i -g inline-source-cli uglify-es clean-css-cli


# Choose version of plotly.js
plotly_version=2.16.1


# clean create ./dist folder
rm -rf ../dist
mkdir -p ../dist/lib


# Create temporary versionless plotly file
cp ../js/vendor/plotly-$plotly_version.min.js ../js/vendor/plotly.min.js


# minify, concat and copy all vendor scripts into one ./dist/lib/vendor.min.js
declare -a js_vendor_list=(
  "../js/vendor/plotly.min.js"
  "../js/vendor/jquery.min.js"
  "../js/vendor/what-input.js"
  "../js/vendor/foundation.min.js"
  "../js/vendor/moment.min.js"
  "../js/vendor/katex.min.js"
  "../js/vendor/auto-render.min.js"
  "../js/vendor/marked.min.js"
  "../js/vendor/highlight.min.js"
)
uglifyjs $(IFS=" " ; echo "${js_vendor_list[*]}") -o ../dist/lib/vendor.min.js -c

# minify, concat and copy all vendor styles into one ./dist/lib/vendor.min.css
declare -a css_vendor_list=(
  "../css/foundation.min.css"
  "../css/katex-embed-fonts.min.css"
  "../css/highlight.min.css"
)
cleancss -o ../dist/lib/vendor.min.css $(IFS=" " ; echo "${css_vendor_list[*]}")

# minify main report CSS file and copy it to ./dist
cleancss -o ../dist/lib/report.min.css ../css/main.css

# minify, concat and copy all report rendering scripts into one ./dist/lib/render.min.js
declare -a js_report_list=(
  "../js/databank/databank.js"
  "../js/report-utils.js"
  "../js/report-settings.js"
  "../js/report-renderer.js"
)
uglifyjs $(IFS=" " ; echo "${js_report_list[*]}") -o ../dist/lib/render.min.js -c

# copy IRIS logo to ./dist/img/
mkdir -p ../dist/img
cp ../img/iris-logo.png ../dist/img/iris-logo.png

# preprocess html replacing vendor and report <script> and <link>
# tags with the references to their bundles
cp ../report-template.html ../dist/report-template.html
python replace-refs.py

# create bundled version of HTML
cd ../dist
inline-source --compress true report-template.html report-template.bundle.html

