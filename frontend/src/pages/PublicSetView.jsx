import { useParams } from "react-router-dom";

function PublicSetView() {
  // get the setId from the url (for example /public/5 gives setId = "5")
  const { setId } = useParams();

  return (
    <div>
      <h1>Public Set View</h1>
      <p>Viewing public set: {setId}</p>
    </div>
  );
}

export default PublicSetView;