-- Block money_out transactions for PO route QMHQ
-- PO route should only allow Money In transactions. Spending happens through Purchase Orders, not direct money out.

CREATE OR REPLACE FUNCTION validate_transaction_type_for_route()
RETURNS TRIGGER AS $$
DECLARE
  v_route_type route_type;
BEGIN
  -- Get the route type of the QMHQ
  SELECT route_type INTO v_route_type
  FROM qmhq WHERE id = NEW.qmhq_id;

  -- Block money_out for PO routes
  IF v_route_type = 'po' AND NEW.transaction_type = 'money_out' THEN
    RAISE EXCEPTION 'Money Out transactions are not allowed for PO route. Use Purchase Orders to spend funds.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_transaction_type ON financial_transactions;
CREATE TRIGGER trg_validate_transaction_type
  BEFORE INSERT ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_transaction_type_for_route();

-- Comment
COMMENT ON FUNCTION validate_transaction_type_for_route() IS 'Blocks money_out transactions for PO route QMHQ. PO route spending goes through Purchase Orders.';
