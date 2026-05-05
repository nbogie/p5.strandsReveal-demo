// p5.strandsReveal — a tiny p5 v2 addon that captures the JavaScript that
// p5.strands transpiles your shader callback into.
//
// The strands transpiler builds an internal callback via
// `new Function('__p5', ...paramNames, body)` from inside
// p5.Shader.prototype.modify. We wrap modify, swap globalThis.Function for
// the duration of that single call, capture the body, and put it back.
//
// API:
//   p5.strandsReveal.last       — most recent capture, or null
//   p5.strandsReveal.history    — array of every capture this session
//   p5.strandsReveal.log()      — pretty-prints the last capture
//   p5.strandsReveal.clear()    — wipes history
//   shader._strandsTranspiledJS — capture is also attached to the shader
//   revealStrandsTranspile(shader?) — global helper, logs to console
//   getStrandsTranspile(shader?)   — global helper, returns the record

function strandsReveal(p5, fn) {
    const captures = [];
    let lastCapture = null;

    const origModify = p5.Shader.prototype.modify;

    p5.Shader.prototype.modify = function (cb, scope, options) {
        if (typeof cb !== "function" && typeof cb !== "string") {
            return origModify.call(this, cb, scope, options);
        }

        const RealFunction = globalThis.Function;
        let captured = null;

        function ShimFunction(...args) {
            // Strands' transpiler always calls `new Function('__p5', ...params, body)`.
            // Filter on that signature so we don't pick up any unrelated Function
            // construction that happens to occur during the same call.
            if (args.length >= 2 && args[0] === "__p5" && !captured) {
                captured = {
                    params: args.slice(0, -1),
                    body: args[args.length - 1],
                };
            }
            return new RealFunction(...args);
        }
        ShimFunction.prototype = RealFunction.prototype;

        globalThis.Function = ShimFunction;
        let shader;
        try {
            shader = origModify.call(this, cb, scope, options);
        } finally {
            globalThis.Function = RealFunction;
        }

        if (captured) {
            const original = typeof cb === "string" ? cb : cb.toString();
            const record = {
                original,
                params: captured.params,
                body: captured.body,
                formatted: `function (${captured.params.join(", ")}) {\n${captured.body}\n}`,
                timestamp: Date.now(),
            };
            try {
                if (shader && typeof shader === "object") {
                    shader._strandsTranspiledJS = record;
                }
            } catch (_) {
                /* shader may be frozen; ignore */
            }
            captures.push(record);
            lastCapture = record;
        }

        return shader;
    };

    p5.strandsReveal = {
        get last() {
            return lastCapture;
        },
        get history() {
            return captures.slice();
        },
        log(record) {
            const r = record || lastCapture;
            if (!r) {
                console.log(
                    "[strandsReveal] no transpiled callback captured yet",
                );
                return;
            }
            console.group("[strandsReveal] transpiled strands callback");
            console.log("--- original source ---");
            console.log(r.original);
            console.log(
                "--- transpiled JS (what strands actually executes) ---",
            );
            console.log(r.formatted);
            console.groupEnd();
        },
        clear() {
            captures.length = 0;
            lastCapture = null;
        },
    };

    fn.revealStrandsTranspile = function (shaderOrRecord) {
        const r =
            shaderOrRecord && shaderOrRecord._strandsTranspiledJS
                ? shaderOrRecord._strandsTranspiledJS
                : shaderOrRecord || lastCapture;
        p5.strandsReveal.log(r);
    };

    fn.getStrandsTranspile = function (shader) {
        if (shader && shader._strandsTranspiledJS)
            return shader._strandsTranspiledJS;
        return lastCapture;
    };
}

if (typeof p5 !== "undefined") {
    p5.registerAddon(strandsReveal);
}
