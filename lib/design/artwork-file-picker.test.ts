import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARTWORK_FILE_INPUT_ACCEPT,
  triggerArtworkFilePicker,
} from "./artwork-file-picker";

describe("artwork file picker", () => {
  it("exposes the accepted artwork extensions for the hidden input", () => {
    assert.match(ARTWORK_FILE_INPUT_ACCEPT, /\.svg/);
    assert.match(ARTWORK_FILE_INPUT_ACCEPT, /\.png/);
    assert.match(ARTWORK_FILE_INPUT_ACCEPT, /\.pdf/);
  });

  it("returns false when the input ref is missing", () => {
    assert.equal(triggerArtworkFilePicker(null), false);
    assert.equal(triggerArtworkFilePicker(undefined), false);
  });

  it("forwards Replace/Choose File clicks to the mounted input", () => {
    let clicked = false;
    const input = {
      click: () => {
        clicked = true;
      },
    } as HTMLInputElement;

    assert.equal(triggerArtworkFilePicker(input), true);
    assert.equal(clicked, true);
  });
});
