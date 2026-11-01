#define HSC_EXT
#define tree_sitter_haskell_external_scanner_create tree_sitter_hsc_external_scanner_create
#define tree_sitter_haskell_external_scanner_destroy tree_sitter_hsc_external_scanner_destroy
#define tree_sitter_haskell_external_scanner_scan tree_sitter_hsc_external_scanner_scan
#define tree_sitter_haskell_external_scanner_serialize tree_sitter_hsc_external_scanner_serialize
#define tree_sitter_haskell_external_scanner_deserialize tree_sitter_hsc_external_scanner_deserialize
#include "../../src/scanner.c"

typedef struct {
  Env *env;
  bool backslash;
} HscCursor;

static void hsc_consume_args(Env *env, bool line);
static void hsc_skip_cpp_directive(Env *env, bool commit);
static bool hsc_cpp_boundary(Env *env);
static bool hsc_text_symbol(int32_t c);
static void hsc_skip_text(Env *env);
static bool hsc_text_comment(Env *env);
static uint32_t hsc_char_end(Env *env);
static bool hsc_text_id_char(int32_t c);
static void hsc_quoted(HscCursor *cursor, int32_t quote);
static void hsc_block_comment(HscCursor *cursor);
static void hsc_line_comment(HscCursor *cursor);
static uint32_t hsc_cpp_start(Env *env, bool *braced);
static bool hsc_cpp_token(Env *env, uint32_t start, const char *name);
static uint32_t hsc_prefix_space(Env *env, uint32_t i, bool multiline);
static void hsc_advance(HscCursor *cursor);
static int32_t hsc_current(HscCursor *cursor);
static void hsc_splices(HscCursor *cursor);

static uint32_t symop_lookahead(Env *env) {
  if (env->symop == 0) {
    uint32_t i = 0;
    while (symop_char(peek(env, i))) {
      if (char_at(env, i, '#')) {
        if (!char_at(env, i + 1, '#')) break;
        i += 2;
      } else i++;
    }
    env->symop = i;
  }
  return env->symop;
}

static Lexed lex_hsc_hash(Env *env) {
  if (!char1(env, '#')) return LHscHash;
  uint32_t len = symop_lookahead(env);
  if (len == 2) return char2(env, ')') ? LUnboxedClose : LHash;
  if ((len == 3 && char2(env, '|')) ||
      (len == 4 && char2(env, '#') && char_at(env, 3, '#'))) return LSymopSpecial;
  return LSymop;
}

static CppDirective hsc_cpp_directive(Env *env) {
  bool braced;
  uint32_t start = hsc_cpp_start(env, &braced);
  if (start == 0) return CppNothing;
  for (unsigned i = 0; i < sizeof(cpp_tokens_start) / sizeof(cpp_tokens_start[0]); i++)
    if (hsc_cpp_token(env, start, cpp_tokens_start[i])) return CppStart;
  for (unsigned i = 0; i < sizeof(cpp_tokens_else) / sizeof(cpp_tokens_else[0]); i++)
    if (hsc_cpp_token(env, start, cpp_tokens_else[i])) return CppElse;
  if (hsc_cpp_token(env, start, "endif")) return CppEnd;
  for (unsigned i = 0; i < sizeof(cpp_tokens_other) / sizeof(cpp_tokens_other[0]); i++)
    if (hsc_cpp_token(env, start, cpp_tokens_other[i])) return CppOther;
  if (char_at(env, start, '!') && uninitialized(env)) return CppOther;
  return CppNothing;
}

static void hsc_take_cpp(Env *env) {
  bool braced;
  hsc_cpp_start(env, &braced);
  hsc_consume_args(env, !braced);
  if (braced && PEEK == '}') S_ADVANCE;
}

static void hsc_skip_cpp_else(Env *env, bool emit) {
  uint32_t nesting = 1;
  hsc_skip_cpp_directive(env, emit);
  reset_lookahead(env);
  while (not_eof(env)) {
    if (emit) MARK("hsc cpp_else");
    if (hsc_cpp_boundary(env)) {
      CppDirective directive = hsc_cpp_directive(env);
      if (directive == CppEnd && --nesting == 0) return;
      if (directive == CppStart) nesting++;
      hsc_skip_cpp_directive(env, emit);
    } else hsc_skip_text(env);
    reset_lookahead(env);
  }
  if (emit) MARK("hsc cpp-else eof");
}

static void hsc_skip_cpp_directive(Env *env, bool commit) {
  if (commit) track_import_macro(env);
  hsc_take_cpp(env);
}

static bool hsc_cpp_boundary(Env *env) {
  bool bol = env->lexer->get_display_column(env->lexer, 8) == 0;
  return PEEK == '#' && (!hsc_text_symbol(peek1(env)) || (char1(env, '#') && bol));
}

static bool hsc_text_symbol(int32_t c) {
  return c > 0 && c < 128 && strchr("!#$%&*+./<=>?@\\^|-~", c) != NULL;
}

static void hsc_skip_text(Env *env) {
  int32_t c = peek0(env);
  if (c == '"') advance_over(env, take_string_literal(env) - 1);
  else if (c == '\'') advance_over(env, hsc_char_end(env));
  else if (c == '{' && char1(env, '-')) {
    advance_over(env, 1);
    consume_block_comment(env, 0, false);
  } else if (c == '-' && hsc_text_comment(env)) {
    while (not_eof(env) && PEEK != '\n') S_ADVANCE;
  }
  else if (hsc_text_symbol(c)) advance_before(env, advance_while(env, 0, hsc_text_symbol));
  else if (hsc_text_id_char(c)) advance_before(env, advance_while(env, 0, hsc_text_id_char));
  else advance_over(env, 0);
}

static bool hsc_text_comment(Env *env) {
  if (!char1(env, '-')) return false;
  uint32_t i = 2;
  while (char_at(env, i, '-')) i++;
  return !hsc_text_symbol(peek(env, i));
}

static uint32_t hsc_char_end(Env *env) {
  if (char1(env, '\\')) return advance_until_char(env, 3, '\'');
  return char_at(env, 2, '\'') ? 2 : 0;
}

static bool hsc_text_id_char(int32_t c) { return c != '#' && is_id_char(c); }

static Symbol hsc_args(Env *env, Symbol sym, bool line) {
  hsc_consume_args(env, line);
  return finish_marked(env, sym, "hsc args");
}

static void hsc_consume_args(Env *env, bool line) {
  uint32_t depth = 0;
  HscCursor cursor = { .env = env };
  hsc_splices(&cursor);
  while (cursor.backslash || not_eof(env)) {
    int32_t c = hsc_current(&cursor);
    if (c == '\n' && line && depth == 0) return;
    switch (c) {
      case '(': case '[': case '{':
        depth++;
        hsc_advance(&cursor);
        break;
      case ')': case ']': case '}':
        if (depth == 0) return;
        depth--;
        hsc_advance(&cursor);
        break;
      case '"': case '\'': hsc_quoted(&cursor, c); break;
      case '/':
        hsc_advance(&cursor);
        if (hsc_current(&cursor) == '/') hsc_line_comment(&cursor);
        else if (hsc_current(&cursor) == '*') hsc_block_comment(&cursor);
        break;
      default: hsc_advance(&cursor); break;
    }
  }
}

static void hsc_quoted(HscCursor *cursor, int32_t quote) {
  hsc_advance(cursor);
  while (cursor->backslash || not_eof(cursor->env)) {
    int32_t c = hsc_current(cursor);
    hsc_advance(cursor);
    if (c == quote) return;
    if (c == '\\' && (cursor->backslash || not_eof(cursor->env))) hsc_advance(cursor);
  }
}

static void hsc_block_comment(HscCursor *cursor) {
  hsc_advance(cursor);
  while (cursor->backslash || not_eof(cursor->env)) {
    int32_t c = hsc_current(cursor);
    hsc_advance(cursor);
    if (c == '*' && hsc_current(cursor) == '/') {
      hsc_advance(cursor);
      return;
    }
  }
}

static void hsc_line_comment(HscCursor *cursor) {
  while ((cursor->backslash || not_eof(cursor->env)) && hsc_current(cursor) != '\n') hsc_advance(cursor);
}

static uint32_t hsc_cpp_start(Env *env, bool *braced) {
  uint32_t i = hsc_prefix_space(env, 0, false);
  *braced = false;
  if (!char_at(env, i, '#')) return 0;
  i++;
  if (char_at(env, i, '#')) i++;
  i = hsc_prefix_space(env, i, false);
  if (char_at(env, i, '{')) {
    *braced = true;
    i = hsc_prefix_space(env, i + 1, true);
  }
  return i;
}

static bool hsc_cpp_token(Env *env, uint32_t start, const char *name) {
  uint32_t i = start;
  for (; *name; name++) {
    i = cpp_splices(env, i);
    if (peek(env, i++) != *name) return false;
  }
  int32_t end = peek(env, cpp_splices(env, i));
  return !(is_id_char(end) && end != '\'');
}

static uint32_t hsc_prefix_space(Env *env, uint32_t i, bool multiline) {
  for (;;) {
    i = cpp_splices(env, i);
    int32_t c = peek(env, i);
    if (is_string_gap_space(c) && (multiline || c != '\n')) i++;
    else return i;
  }
}

static void hsc_advance(HscCursor *cursor) {
  Env *env = cursor->env;
  if (!cursor->backslash) S_ADVANCE;
  hsc_splices(cursor);
}

static int32_t hsc_current(HscCursor *cursor) {
  return cursor->backslash ? '\\' : cursor->env->lexer->lookahead;
}

static void hsc_splices(HscCursor *cursor) {
  Env *env = cursor->env;
  cursor->backslash = false;
  while (PEEK == '\\') {
    S_ADVANCE;
    if (PEEK == '\r') S_ADVANCE;
    if (PEEK != '\n') {
      cursor->backslash = true;
      break;
    }
    S_ADVANCE;
  }
}
