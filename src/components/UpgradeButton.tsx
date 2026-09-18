// Pro isn't purchasable yet (no payment provider), so this is an honest placeholder rather than a checkout.
// When payments launch, restore a client button that calls startUpgrade() in src/app/actions.ts.
export function UpgradeButton({ className = "btn-secondary" }: { className?: string; label?: string }) {
  return (
    <span className={`${className} pointer-events-none cursor-default opacity-70`} aria-disabled="true">
      Pro — coming soon
    </span>
  );
}
