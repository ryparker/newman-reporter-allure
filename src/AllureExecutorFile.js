const fs = require('fs')
function create(resultsDir, { type, name, url, reportName, reportUrl, buildOrder, buildName, buildUrl }) {
  console.log('Writing file in AllureExecutorFile.create()')
  fs.writeFileSync(
    `${resultsDir}/executor.json`,
    JSON.stringify({
      type,
      name,
      url,
      reportName,
      reportUrl,
      buildOrder,
      buildName,
      buildUrl,
    })
  )
  console.log('Finished writing file in AllureExecutorFile.create().')
}

module.exports = { create }
