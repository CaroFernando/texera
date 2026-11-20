import { Button, Result } from "antd";
import { Link } from "react-router";
import { paths } from "@exp/shared";

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="Page not found"
      extra={
        <Link to={paths.home}>
          <Button type="primary">Back to the hub</Button>
        </Link>
      }
    />
  );
}
