export default function Loading() {
  return (
    <div className="okapi-loading-page" role="status" aria-label="Chargement en cours">
      <span className="okapi-loader">
        <span className="okapi-loader-ring" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/okapi-o-mark.png" alt="" className="okapi-loader-mark" />
      </span>
    </div>
  );
}
