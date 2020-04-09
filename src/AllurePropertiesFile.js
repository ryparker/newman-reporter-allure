const fs = require('fs')
function create(resultsDir, jiraUrl) {
  console.log('Writing file in AllurePropertiesFile.create().')

  fs.writeFileSync(`${resultsDir}/allure.properties`, `allure.link.issue.pattern=${jiraUrl}`)
  console.log('Finished writing file in AllurePropertiesFile.create().')
}

module.exports = { create }
