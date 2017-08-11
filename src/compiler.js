import AV from "./assignment-visitor.js"
import FastPath from "./fast-path.js"
import IEV from "./import-export-visitor.js"
import Parser from "./parser.js"

import createOptions from "./util/create-options.js"
import stripShebang from "./util/strip-shebang.js"

const defaultOptions = createOptions({
  cjs: false,
  ext: false,
  hint: "script",
  runtimeAlias: "_",
  type: "module",
  var: false
})

const assignmentVisitor = new AV
const importExportVisitor = new IEV
const useModuleRegExp = /(["'])use module\1/

// Matches any {im,ex}port identifier as long as it's not preceded by a "."
// character (e.g. `runtime.export`) to prevent the compiler from compiling
// code it has already compiled.
const importExportRegExp = /(?:^|[^.]\b)(?:im|ex)port\b/

class Compiler {
  static compile(code, options) {
    code = stripShebang(code)
    options = createOptions(options, defaultOptions)

    const { hint, type } = options

    const result = {
      code,
      data: null,
      type: "script"
    }

    if (type === "unambiguous" &&
        (Parser.hasPragma(code, "use script") ||
          (hint !== "module" &&
          ! importExportRegExp.test(code) &&
          ! useModuleRegExp.test(code)))) {
      return result
    }

    const rootPath = new FastPath(Parser.parse(code, {
      allowReturnOutsideFunction: options.cjs,
      enableExportExtensions: options.ext,
      enableImportExtensions: options.ext
    }))

    importExportVisitor.visit(rootPath, code, {
      generateVarDeclarations: options.var,
      runtimeAlias: options.runtimeAlias
    })

    if (importExportVisitor.addedImportExport) {
      assignmentVisitor.visit(rootPath, {
        exportedLocalNames: importExportVisitor.exportedLocalNames,
        importedLocalNames: importExportVisitor.importedLocalNames,
        magicString: importExportVisitor.magicString,
        runtimeAlias: importExportVisitor.runtimeAlias
      })

      importExportVisitor.finalizeHoisting()
    }

    if (type === "module" ||
        importExportVisitor.addedImportExport ||
        (type === "unambiguous" &&
          (hint === "module" ||
          Parser.hasPragma(code, "use module")))) {
      result.type = "module"
    }

    result.code = importExportVisitor.magicString.toString()
    return result
  }
}

Object.setPrototypeOf(Compiler.prototype, null)

export default Compiler
