export default function Loading() {
  return (
    <div className="okapi-loading-page" role="status" aria-label="Chargement en cours">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/okapi-o-mark.png" alt="" className="okapi-spinner" />
    </div>
  );
}
