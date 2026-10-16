
import { useParams } from "react-router-dom";

function StudyReview() {
    const { setId } = useParams();

    return (
        <div>
            <h1>Study Review</h1>
            <p>Studying set: {setId}</p>
        </div>
    );
}

export default StudyReview;
