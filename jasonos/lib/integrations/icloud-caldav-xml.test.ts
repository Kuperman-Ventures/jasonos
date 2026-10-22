import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hrefInsideProperty,
  parseMultistatus,
} from "./icloud-caldav-xml.ts";

describe("hrefInsideProperty", () => {
  it("reads current-user-principal, not the response href", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/</href>
    <propstat>
      <prop>
        <current-user-principal>
          <href>/40215087/principal/</href>
        </current-user-principal>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`;
    const root = parseMultistatus(xml)!;
    assert.equal(
      hrefInsideProperty(root, "current-user-principal"),
      "/40215087/principal/"
    );
  });

  it("reads calendar-home-set absolute href", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/40215087/principal/</href>
    <propstat>
      <prop>
        <calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav">
          <href xmlns="DAV:">https://p31-caldav.icloud.com:443/40215087/calendars/</href>
        </calendar-home-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`;
    const root = parseMultistatus(xml)!;
    assert.equal(
      hrefInsideProperty(root, "calendar-home-set"),
      "https://p31-caldav.icloud.com:443/40215087/calendars/"
    );
  });
});
