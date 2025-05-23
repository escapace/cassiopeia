export const ruleSetupClientImportSFCHelper = {
  rule: {
    any: [
      {
        pattern: "import _export_sfc from '$$$'",
      },
      {
        pattern: 'import _export_sfc from "$$$"',
      },
    ],
  },
}

export const ruleSetupClientExportSFC = {
  rule: {
    any: [
      {
        pattern: 'export default _sfc_main',
      },
    ],
  },
}

export const ruleSetupSSR = {
  rule: {
    any: [
      {
        any: [
          {
            pattern: {
              context: '_sfc_main.setup = ($$$) => {$$$BODY}',
              selector: 'statement_block',
            },
          },
        ],
        inside: {
          inside: {
            inside: {
              regex: '_sfc_main\\.setup',
            },
            kind: 'assignment_expression',
          },
          kind: 'arrow_function',
        },
      },
    ],
  },
}
