import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { PositionKey } from "../PositionKey.js";
import { t } from "../i18n.js";

const list = () =>
  screen.getByRole("list", { name: t("en", "spreadPositions") });

describe("PositionKey", () => {
  it("reads values and actions by position index and adds nothing for the gaps", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    const blocked = vi.fn();
    render(
      <PositionKey
        language="en"
        names={["Past", "Present", "Future"]}
        values={[undefined, "The Fool · Upright"]}
        actions={[
          undefined,
          { label: "Present. Open The Fool", onActivate: open },
          { label: "Future. Turn card 3", onActivate: blocked, disabled: true },
        ]}
      />,
    );
    const items = within(list()).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).queryByRole("button")).toBeNull();
    expect(within(items[0]).getByText("Past")).not.toBeNull();

    const openButton = within(items[1]).getByRole<HTMLButtonElement>("button", {
      name: "Present. Open The Fool",
    });
    expect(within(openButton).getByText("Present")).not.toBeNull();
    expect(within(openButton).getByText("The Fool · Upright")).not.toBeNull();
    await user.click(openButton);
    expect(open).toHaveBeenCalledOnce();

    const blockedButton = within(items[2]).getByRole<HTMLButtonElement>(
      "button",
      {
        name: "Future. Turn card 3",
      },
    );
    expect(blockedButton.disabled).toBe(true);
    expect(screen.getAllByText("The Fool · Upright")).toHaveLength(1);
    await user.click(blockedButton);
    expect(blocked).not.toHaveBeenCalled();
  });

  it("renders an empty list rather than invented positions", () => {
    render(<PositionKey language="en" names={[]} values={["stray"]} />);
    expect(within(list()).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText("stray")).toBeNull();
  });
});
