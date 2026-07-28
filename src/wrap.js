// Fixed-width wrapping for the plain-text record and specification.
// Hard-breaks tokens longer than the column; filenames and asset IDs hit that.
function wrap(text, width) {
  const out = [];
  let line = '';
  const push = () => {
    if (line.length) out.push(line);
    line = '';
  };
  text.split(/\s+/).forEach((word) => {
    let rest = word;
    // A single token longer than the column has to be cut, or it runs past
    // the width of the record on its own. Filenames and asset IDs do this.
    while (rest.length > width) {
      push();
      out.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    if (!rest.length) return;
    if (!line.length) {
      line = rest;
    } else if (line.length + 1 + rest.length <= width) {
      line += ` ${rest}`;
    } else {
      push();
      line = rest;
    }
  });
  push();
  return out;
}

export { wrap };
